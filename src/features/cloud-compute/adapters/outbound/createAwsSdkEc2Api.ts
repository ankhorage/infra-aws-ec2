import type { InfraComputeSelection, InfraResult } from '@ankhorage/contracts/infra';
import {
  type _InstanceType,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeInstanceTypesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  EC2Client,
  RunInstancesCommand,
  type RunInstancesCommandInput,
  StartInstancesCommand,
  TerminateInstancesCommand,
} from '@aws-sdk/client-ec2';

import type {
  AwsEc2Api,
  AwsEc2CreateInput,
  AwsEc2Identity,
  AwsEc2Instance,
} from '../../../../types/awsEc2.js';

/*** Create a bounded modular AWS SDK v3 EC2 adapter; SDK credentials stay in the process credential chain. */
export function createAwsSdkEc2Api(): AwsEc2Api {
  return new AwsSdkEc2Api();
}

class AwsSdkEc2Api implements AwsEc2Api {
  async validateAsync(
    selection: InfraComputeSelection<'aws-ec2'>,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>> {
    try {
      const client = new EC2Client({ region: selection.region });
      await Promise.all([
        client.send(new DescribeImagesCommand({ ImageIds: [selection.ami] }), {
          abortSignal: signal,
        }),
        client.send(
          new DescribeInstanceTypesCommand({
            InstanceTypes: [selection.instanceType as _InstanceType],
          }),
          { abortSignal: signal },
        ),
        client.send(new DescribeSubnetsCommand({ SubnetIds: [selection.subnetId] }), {
          abortSignal: signal,
        }),
        client.send(
          new DescribeSecurityGroupsCommand({ GroupIds: [...selection.securityGroupIds] }),
          { abortSignal: signal },
        ),
      ]);
      return ok(null);
    } catch {
      return fail('aws-ec2-validation-failed');
    }
  }
  async inspectAsync(
    identity: AwsEc2Identity,
    signal?: AbortSignal,
  ): Promise<InfraResult<readonly AwsEc2Instance[]>> {
    try {
      const client = new EC2Client({});
      const result = await client.send(
        new DescribeInstancesCommand({
          Filters: Object.entries(tags(identity)).map(([Name, Values]) => ({
            Name,
            Values: [Values],
          })),
        }),
        { abortSignal: signal },
      );
      const instances = (result.Reservations ?? [])
        .flatMap((reservation) => reservation.Instances ?? [])
        .map((instance) => ({
          id: instance.InstanceId ?? '',
          state: mapState(instance.State?.Name),
          publicIp: instance.PublicIpAddress,
          privateIp: instance.PrivateIpAddress,
          configurationHash: instance.Tags?.find(
            (tag) => tag.Key === 'ankhorage:configuration-hash',
          )?.Value,
        }))
        .filter((instance) => instance.id.length > 0);
      return instances.length > 1 ? fail('aws-ec2-ownership-collision') : ok(instances);
    } catch {
      return fail('aws-ec2-inspection-failed');
    }
  }
  async createAsync(
    input: AwsEc2CreateInput,
    signal?: AbortSignal,
  ): Promise<InfraResult<AwsEc2Instance>> {
    try {
      const client = new EC2Client({ region: input.selection.region });
      const result = await client.send(new RunInstancesCommand(createRequest(input)), {
        abortSignal: signal,
      });
      const instance = result.Instances?.[0];
      return instance?.InstanceId === undefined
        ? fail('aws-ec2-create-failed')
        : ok({ id: instance.InstanceId, state: 'pending' });
    } catch {
      return fail('aws-ec2-create-failed');
    }
  }
  async startAsync(instanceId: string, signal?: AbortSignal): Promise<InfraResult<null>> {
    try {
      await new EC2Client({}).send(new StartInstancesCommand({ InstanceIds: [instanceId] }), {
        abortSignal: signal,
      });
      return ok(null);
    } catch {
      return fail('aws-ec2-start-failed');
    }
  }
  async terminateAsync(instanceId: string, signal?: AbortSignal): Promise<InfraResult<null>> {
    try {
      await new EC2Client({}).send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }), {
        abortSignal: signal,
      });
      return ok(null);
    } catch {
      return fail('aws-ec2-destroy-failed');
    }
  }
}

/*** Map secure portable EC2 intent into a single SDK create request. */
function createRequest(input: AwsEc2CreateInput): RunInstancesCommandInput {
  return {
    ImageId: input.selection.ami,
    InstanceType: input.selection.instanceType as _InstanceType,
    MinCount: 1,
    MaxCount: 1,
    ClientToken:
      `${input.identity.projectId}-${input.identity.environment}-${input.configurationHash}`.slice(
        0,
        64,
      ),
    SubnetId: input.selection.subnetId,
    SecurityGroupIds: [...input.selection.securityGroupIds],
    KeyName: input.selection.ssh.keyName,
    IamInstanceProfile:
      input.selection.iamInstanceProfile === undefined
        ? undefined
        : { Name: input.selection.iamInstanceProfile },
    MetadataOptions: { HttpTokens: 'required' },
    BlockDeviceMappings: [
      {
        DeviceName: '/dev/sda1',
        Ebs: {
          Encrypted: true,
          VolumeSize: input.selection.rootVolume?.sizeGiB,
          VolumeType: input.selection.rootVolume?.type,
          DeleteOnTermination: input.selection.rootVolume?.deleteOnTermination ?? true,
        },
      },
    ],
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: Object.entries({
          ...tags(input.identity),
          'ankhorage:configuration-hash': input.configurationHash,
          ...input.selection.tags,
        }).map(([Key, Value]) => ({ Key, Value })),
      },
    ],
  };
}
function tags(identity: AwsEc2Identity): Record<string, string> {
  return {
    'ankhorage:project-id': identity.projectId,
    'ankhorage:environment': identity.environment,
    'ankhorage:adapter': 'aws-ec2',
  };
}
function mapState(state: string | undefined): AwsEc2Instance['state'] {
  if (
    state === 'running' ||
    state === 'stopped' ||
    state === 'stopping' ||
    state === 'shutting-down' ||
    state === 'terminated' ||
    state === 'pending'
  )
    return state;
  return 'failed';
}
function ok<T>(value: T): InfraResult<T> {
  return { ok: true, value, diagnostics: [] };
}
function fail(code: string): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [{ severity: 'error', code, message: 'AWS EC2 API operation failed.' }],
  };
}
