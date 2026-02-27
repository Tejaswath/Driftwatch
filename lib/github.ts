import { serverConfig } from "@/lib/config";

type DispatchInput = Record<string, string>;

export async function dispatchWorkflow(
  workflowFile: string,
  inputs: DispatchInput
): Promise<{ workflow_run_url: string }> {
  const endpoint = `https://api.github.com/repos/${serverConfig.githubRepo}/actions/workflows/${workflowFile}/dispatches`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${serverConfig.githubDispatchToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ref: serverConfig.githubRef,
      inputs
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to dispatch workflow (${response.status}): ${detail}`);
  }

  return {
    workflow_run_url: `https://github.com/${serverConfig.githubRepo}/actions/workflows/${workflowFile}`
  };
}
