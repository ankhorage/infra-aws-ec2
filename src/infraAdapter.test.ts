import type { InfraExecutionContext } from '@ankhorage/contracts/infra';
import { expect, test } from 'bun:test';

import { type AwsEc2Api, createInfraAdapter, infraAdapterDescriptor } from './index.js';

const context = {
  projectId: 'project',
  environment: 'production',
  desired: {
    deployment: {
      compute: {
        provider: 'aws-ec2',
        region: 'eu-central-1',
        instanceType: 't3.large',
        ami: 'ami-0123456789abcdef0',
        architecture: 'x86_64',
        vpcId: 'vpc-1',
        subnetId: 'subnet-1',
        securityGroupIds: ['sg-1'],
        ssh: {
          keyName: 'project',
          credentials: { source: 'control-plane', name: 'AWS_EC2_SSH' },
          hostKeyFingerprint: 'SHA256:host',
          authorizedCidrs: ['203.0.113.10/32'],
        },
      },
      runtime: { provider: 'docker-compose' },
    },
  },
  credentials: {
    findAsync: () => Promise.resolve({ ok: true as const, value: null, diagnostics: [] }),
    resolveAsync: () => Promise.resolve({ ok: true as const, value: {}, diagnostics: [] }),
    persistAsync: () => Promise.resolve({ ok: true as const, value: null, diagnostics: [] }),
  },
  secrets: {
    resolveAsync: () => Promise.resolve({ ok: true as const, value: '', diagnostics: [] }),
  },
} as const satisfies InfraExecutionContext;
const api: AwsEc2Api = {
  validateAsync: () => Promise.resolve({ ok: true, value: null, diagnostics: [] }),
  inspectAsync: () => Promise.resolve({ ok: true, value: [], diagnostics: [] }),
  createAsync: () =>
    Promise.resolve({ ok: true, value: { id: 'i-1', state: 'pending' }, diagnostics: [] }),
  startAsync: () => Promise.resolve({ ok: true, value: null, diagnostics: [] }),
  terminateAsync: () => Promise.resolve({ ok: true, value: null, diagnostics: [] }),
};

test('projects the canonical descriptor and creates an owned instance plan', async () => {
  const adapter = createInfraAdapter({ api });
  expect(adapter.descriptor).toEqual(infraAdapterDescriptor);
  const plan = await adapter.planAsync(context, context.desired.deployment.compute);
  expect(plan.ok).toBe(true);
  if (plan.ok) expect(plan.value[0]?.operation).toBe('create');
});
