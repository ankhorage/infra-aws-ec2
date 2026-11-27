import type {
  InfraComputeSelection,
  InfraExecutionContext,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { AwsEc2ExecutionContext } from '../../../types/awsEc2.js';

/*** Resolve explicit AWS credentials and their trusted account binding from the Infra credential port. */
export async function resolveAwsEc2ExecutionContextAsync(
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'aws-ec2'>,
): Promise<InfraResult<AwsEc2ExecutionContext>> {
  if (selection.credentials === undefined)
    return failure(
      'aws-ec2-credentials-required',
      'AWS EC2 requires an explicit credential reference.',
    );
  const resolved = await context.credentials.resolveAsync(selection.credentials);
  if (!resolved.ok) return resolved;
  const {
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_ACCOUNT_ID: accountId,
    AWS_SESSION_TOKEN: sessionToken,
  } = resolved.value;
  if (accessKeyId === undefined || secretAccessKey === undefined || accountId === undefined)
    return failure(
      'aws-ec2-credentials-invalid',
      'AWS credentials require access key, secret key and account ID.',
    );
  return {
    ok: true,
    value: { region: selection.region, accountId, accessKeyId, secretAccessKey, sessionToken },
    diagnostics: [],
  };
}
function failure(code: string, message: string): InfraResult<never> {
  return { ok: false, diagnostics: [{ severity: 'error', code, message }] };
}
