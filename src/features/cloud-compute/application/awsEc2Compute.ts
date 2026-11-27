import { createHash } from 'node:crypto';

import type {
  InfraComputeAdapter,
  InfraComputeSelection,
  InfraComputeSnapshot,
  InfraExecutionContext,
  InfraPlanAction,
  InfraReconcileResult,
  InfraResourceStatus,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { AwsEc2Api, AwsEc2Identity, AwsEc2Instance } from '../../../types/awsEc2.js';

/*** Validate AWS EC2 config and control-plane access without any mutation. */
export async function validateAwsEc2ComputeAsync(
  api: AwsEc2Api,
  context: InfraExecutionContext,
): Promise<InfraResult<null>> {
  const selection = getSelection(context);
  if (!selection.ok) return selection;
  return api.validateAsync(selection.value, context.signal);
}

/*** Discover only exact project/environment-owned instances without a local ledger. */
export async function inspectAwsEc2ComputeAsync(
  api: AwsEc2Api,
  context: InfraExecutionContext,
): Promise<InfraResult<InfraComputeSnapshot>> {
  const instances = await api.inspectAsync(identity(context), context.signal);
  return instances.ok ? snapshot(context, instances.value) : instances;
}

/*** Produce a deterministic no-mutation EC2 plan, requiring explicit replacement for drift. */
export async function planAwsEc2ComputeAsync(
  api: AwsEc2Api,
  context: InfraExecutionContext,
): Promise<InfraResult<readonly InfraPlanAction[]>> {
  const selection = getSelection(context);
  if (!selection.ok) return selection;
  const inspected = await api.inspectAsync(identity(context), context.signal);
  if (!inspected.ok) return inspected;
  const owner = resource(context).identity;
  const [instance] = inspected.value;
  const hash = configurationHash(selection.value);
  const operation =
    instance === undefined ? 'create' : instance.configurationHash === hash ? 'noop' : 'retain';
  return {
    ok: true,
    value: [
      {
        owner,
        operation,
        impact: operation === 'retain' ? 'interrupts-service' : 'none',
        detail:
          operation === 'retain'
            ? 'EC2 configuration drift requires explicit replacement.'
            : `${operation} owned EC2 instance.`,
        dependsOn: [],
      },
    ],
    diagnostics: [],
  };
}

/*** Reconcile a single owned EC2 instance without silently replacing configuration drift. */
export async function ensureAwsEc2ComputeAsync(
  api: AwsEc2Api,
  context: InfraExecutionContext,
): Promise<InfraResult<InfraComputeSnapshot>> {
  const selection = getSelection(context);
  if (!selection.ok) return selection;
  const inspected = await api.inspectAsync(identity(context), context.signal);
  if (!inspected.ok) return inspected;
  const [current] = inspected.value;
  const hash = configurationHash(selection.value);
  if (current !== undefined && current.configurationHash !== hash)
    return failure(
      'aws-ec2-replacement-required',
      'EC2 configuration drift requires an explicit destroy before replacement.',
    );
  if (current === undefined) {
    const created = await api.createAsync(
      { identity: identity(context), selection: selection.value, configurationHash: hash },
      context.signal,
    );
    return created.ok ? snapshot(context, [created.value]) : created;
  }
  if (current.state === 'stopped') {
    const started = await api.startAsync(current.id, context.signal);
    if (!started.ok) return started;
  }
  return snapshot(context, [current]);
}

/*** Report fresh provider state for the exact owned instance. */
export async function statusAwsEc2ComputeAsync(
  api: AwsEc2Api,
  context: InfraExecutionContext,
): Promise<InfraResult<readonly InfraResourceStatus[]>> {
  const inspected = await api.inspectAsync(identity(context), context.signal);
  if (!inspected.ok) return inspected;
  return {
    ok: true,
    value: inspected.value.map((instance) => ({
      owner: resource(context).identity,
      state:
        instance.state === 'running'
          ? 'ready'
          : instance.state === 'stopped'
            ? 'stopped'
            : instance.state === 'pending'
              ? 'pending'
              : instance.state === 'terminated'
                ? 'absent'
                : instance.state === 'failed'
                  ? 'failed'
                  : 'degraded',
      detail: instance.state,
    })),
    diagnostics: [],
  };
}

/*** Terminate only a confirmed instance carrying the exact project/environment ownership tags. */
export async function destroyAwsEc2ComputeAsync(
  api: AwsEc2Api,
  context: InfraExecutionContext,
  request: Parameters<InfraComputeAdapter<'aws-ec2'>['destroyAsync']>[1],
): Promise<InfraResult<InfraReconcileResult>> {
  if (
    request.projectId !== context.projectId ||
    request.environment !== context.environment ||
    request.confirmation.projectId !== context.projectId ||
    request.confirmation.environment !== context.environment
  )
    return failure(
      'aws-ec2-destroy-unconfirmed',
      'AWS EC2 destroy requires exact project and environment confirmation.',
    );
  const inspected = await api.inspectAsync(identity(context), context.signal);
  if (!inspected.ok) return inspected;
  for (const instance of inspected.value) {
    const removed = await api.terminateAsync(instance.id, context.signal);
    if (!removed.ok) return removed;
  }
  return {
    ok: true,
    value: {
      resources: inspected.value.map((instance) => ({
        ...resource(context),
        externalId: instance.id,
      })),
      outputs: [],
    },
    diagnostics: [],
  };
}

function getSelection(
  context: InfraExecutionContext,
): InfraResult<InfraComputeSelection<'aws-ec2'>> {
  const selection = context.desired.deployment.compute;
  return selection.provider === 'aws-ec2'
    ? { ok: true, value: selection, diagnostics: [] }
    : failure(
        'aws-ec2-selection-invalid',
        'AWS EC2 adapter requires the canonical aws-ec2 compute selection.',
      );
}
function identity(context: InfraExecutionContext): AwsEc2Identity {
  return { projectId: context.projectId, environment: context.environment };
}
function resource(context: InfraExecutionContext) {
  return {
    identity: { ...identity(context), adapter: 'aws-ec2' as const, resourceId: 'instance' },
    persistent: false,
    retention: 'delete-on-destroy' as const,
    dependsOn: [],
  };
}
function configurationHash(selection: InfraComputeSelection<'aws-ec2'>): string {
  return createHash('sha256').update(JSON.stringify(selection)).digest('hex').slice(0, 32);
}
function snapshot(
  context: InfraExecutionContext,
  instances: readonly AwsEc2Instance[],
): InfraResult<InfraComputeSnapshot> {
  const [instance] = instances;
  if (instance?.state !== 'running' || instance.publicIp === undefined)
    return {
      ok: true,
      value: {
        resources: instances.map((item) => ({ ...resource(context), externalId: item.id })),
        outputs: [],
        targets: [],
      },
      diagnostics: [],
    };
  const selection = context.desired.deployment.compute;
  if (selection.provider !== 'aws-ec2')
    return failure('aws-ec2-selection-invalid', 'AWS EC2 selection is unavailable.');
  return {
    ok: true,
    value: {
      resources: [{ ...resource(context), externalId: instance.id }],
      outputs: [
        {
          owner: resource(context).identity,
          name: 'instanceId',
          visibility: 'public',
          value: instance.id,
        },
      ],
      targets: [
        {
          id: instance.id,
          kind: 'ssh-host',
          os: 'linux',
          architecture: selection.architecture === 'x86_64' ? 'amd64' : 'arm64',
          host: instance.publicIp,
          port: selection.ssh.port ?? 22,
          user: selection.ssh.user ?? 'ec2-user',
          credential: selection.ssh.credentials,
          hostKeyFingerprint: selection.ssh.hostKeyFingerprint,
        },
      ],
    },
    diagnostics: [],
  };
}
function failure(code: string, message: string): InfraResult<never> {
  return { ok: false, diagnostics: [{ severity: 'error', code, message }] };
}
