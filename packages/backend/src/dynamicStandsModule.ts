/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import {
  createTemplateAction,
  scaffolderActionsExtensionPoint,
} from '@backstage/plugin-scaffolder-node';

const githubApi = 'https://api.github.com';
const argocdOwner = 'liquidityhub-finance';
const argocdRepo = 'argocd';

type PackageVersion = {
  metadata?: { container?: { tags?: string[] } };
};

type GitHubContent = {
  type: 'file' | 'dir';
  name: string;
  path: string;
  sha: string;
  content?: string;
  html_url?: string;
};

async function githubRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${githubApi}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API ${init?.method ?? 'GET'} ${path} failed: ${
        response.status
      } ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

async function getContainerTags(
  token: string,
  owner: string,
  packageName: string,
) {
  const versions = await githubRequest<PackageVersion[]>(
    token,
    `/orgs/${owner}/packages/container/${encodeURIComponent(
      packageName,
    )}/versions?per_page=100`,
  );
  return [
    ...new Set(
      versions.flatMap(version => version.metadata?.container?.tags ?? []),
    ),
  ].sort();
}

async function listDynamicStands(token: string) {
  const directory = 'environments/dynamic-stands';
  const entries = await githubRequest<GitHubContent[]>(
    token,
    `/repos/${argocdOwner}/${argocdRepo}/contents/${directory}`,
  );
  const files = entries.filter(
    entry =>
      entry.type === 'file' &&
      entry.name.endsWith('.yaml') &&
      entry.name !== 'ds.yaml',
  );
  const stands = await Promise.all(
    files.map(async entry => {
      const file = await githubRequest<GitHubContent>(
        token,
        `/repos/${argocdOwner}/${argocdRepo}/contents/${entry.path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
      );
      const yaml = Buffer.from(file.content ?? '', 'base64').toString('utf8');
      const standName = yaml.match(/^standName:\s*([^\s#]+)\s*$/m)?.[1];
      if (!standName || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(standName)) {
        throw new Error(`Invalid dynamic stand definition: ${entry.path}`);
      }
      return {
        name: standName,
        apiUrl: `https://api-${standName}.ds.tenv.online`,
        appUrl: `https://app-${standName}.ds.tenv.online`,
        fileUrl:
          file.html_url ??
          `https://github.com/${argocdOwner}/${argocdRepo}/blob/main/${entry.path}`,
      };
    }),
  );
  return stands.sort((a, b) => a.name.localeCompare(b.name));
}

async function deleteDynamicStand(token: string, name: string) {
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
    throw new Error('Stand name must be a lowercase DNS label.');
  }
  if (name === 'ds') {
    throw new Error(
      'The base ds environment cannot be deleted from Backstage.',
    );
  }
  const path = `environments/dynamic-stands/${name}.yaml`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const file = await githubRequest<GitHubContent>(
    token,
    `/repos/${argocdOwner}/${argocdRepo}/contents/${encodedPath}`,
  );
  await githubRequest(
    token,
    `/repos/${argocdOwner}/${argocdRepo}/contents/${encodedPath}`,
    {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete dynamic stand ${name}`,
        sha: file.sha,
        branch: 'main',
      }),
    },
  );
}

function environmentYaml(name: string, djangoTag: string, frontTag: string) {
  const namespace = 'ds';
  const domain = `${name}.ds.tenv.online`;
  // A DNS hostname label may start with a number, but Kubernetes resource
  // names (Services, Ingress backends, etc.) may not. Keep the requested name
  // in the URL and labels, while giving every Helm release a stable alphabetic
  // prefix. Prefix every name (rather than only numeric names) to avoid
  // collisions between e.g. "631-640" and "ds-631-640".
  const releasePrefix = `ds-${name}`;
  return `repoURL: https://github.com/${argocdOwner}/${argocdRepo}.git
targetRevision: main
destinationServer: https://kubernetes.default.svc
standName: ${name}
standNamespace: ${namespace}
applications:
  - name: ${releasePrefix}-postgre
    namespace: ${namespace}
    chartPath: HelmCharts/DynamicPostgresChart
    valueFile: values_stage.yaml
    syncOptions: [CreateNamespace=true]
    annotations: { argocd.argoproj.io/sync-wave: '-20' }
    helmValues: |
      namespace: ${namespace}
      podLabels: { stand.liquidityhub.io/name: ${name} }
      backup: { enabled: false }
  - name: ${releasePrefix}-dragonfly
    namespace: ${namespace}
    chartPath: HelmCharts/DynamicDragonflyChart
    valueFile: values_stage.yaml
    syncOptions: [CreateNamespace=true]
    annotations: { argocd.argoproj.io/sync-wave: '-20' }
    helmValues: |
      namespace: ${namespace}
      podLabels: { stand.liquidityhub.io/name: ${name} }
  - name: ${releasePrefix}-django
    namespace: ${namespace}
    chartPath: HelmCharts/DjangoChart
    valueFile: values_stage.yaml
    syncOptions: [CreateNamespace=true, SkipDryRunOnMissingResource=true]
    annotations: { argocd.argoproj.io/sync-wave: '0' }
    helmValues: |
      namespace: ${namespace}
      podLabels: { stand.liquidityhub.io/name: ${name} }
      databaseClone:
        enabled: true
        source: { host: postgres.persistence.svc.cluster.local, port: 5432, username: postgres, password: changeme, database: app }
        target:
          host: ${releasePrefix}-postgre
          port: 5432
          username: postgres
          passwordSecret: { name: ${releasePrefix}-postgre-secret, key: POSTGRES_PASSWORD }
          database: app
      vault:
        secretPath: backend/ds-${name}
        profileClone:
          enabled: true
          sourcePath: backend/stage
          targetPath: backend/ds-${name}
          djangoAllowedHosts: api-${domain}
          djangoCorsAllowedOrigins: https://app-${domain}
          djangoCorsAllowHeaders: X-Team-Id,idempotency-key
      image:
        tag: ${djangoTag}
        imagePullSecrets: [{ name: ghcr-login-secret }]
      command:
        - env
        - DATABASE_URL=postgres://postgres:changeme@${releasePrefix}-postgre:5432/app
        - REDIS_URL=redis://${releasePrefix}-dragonfly:6379/0
        - /start
      ingress:
        hosts: [{ host: api-${domain}, paths: [{ path: /, pathType: Prefix }] }]
  - name: ${releasePrefix}-front-fsd
    namespace: ${namespace}
    chartPath: HelmCharts/FrontChart
    valueFile: values_fsd_stage.yaml
    syncOptions: [CreateNamespace=true, SkipDryRunOnMissingResource=true]
    annotations: { argocd.argoproj.io/sync-wave: '0' }
    helmValues: |
      namespace: ${namespace}
      podLabels: { stand.liquidityhub.io/name: ${name} }
      image:
        repository: ghcr.io/liquidityhub-finance/front_fsd
        tag: ${frontTag}
        imagePullSecrets: [{ name: ghcr-login-secret }]
      ingress:
        hosts: [{ host: app-${domain}, paths: [{ path: /, pathType: Prefix }] }]
`;
}

function createDynamicStandAction(token: string) {
  return createTemplateAction({
    id: 'lh:dynamic-stand:publish',
    description:
      'Validates GHCR tags and commits a dynamic-stand environment to the Argo CD repository.',
    schema: {
      input: {
        name: z => z.string(),
        djangoTag: z => z.string(),
        frontTag: z => z.string(),
      },
      output: { fileUrl: z => z.string() },
    },
    async handler(ctx) {
      const { name, djangoTag, frontTag } = ctx.input;
      if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name) || name.length > 40) {
        throw new Error(
          'Stand name must be a lowercase DNS label up to 40 characters.',
        );
      }

      const [djangoTags, frontTags] = await Promise.all([
        getContainerTags(token, 'manara-development', 'core_backend-django'),
        getContainerTags(token, 'liquidityhub-finance', 'front_fsd'),
      ]);
      if (!djangoTags.includes(djangoTag) || !frontTags.includes(frontTag)) {
        throw new Error(
          `Unknown image tag. Django tags: ${djangoTags.join(
            ', ',
          )}. Frontend tags: ${frontTags.join(', ')}`,
        );
      }

      const path = `environments/dynamic-stands/${name}.yaml`;
      const content = environmentYaml(name, djangoTag, frontTag);
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      try {
        await githubRequest(
          token,
          `/repos/${argocdOwner}/${argocdRepo}/contents/${encodedPath}`,
        );
        throw new Error(`A dynamic stand named "${name}" already exists.`);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes('failed: 404 ')
        )
          throw error;
      }

      const result = await githubRequest<{ content: { html_url: string } }>(
        token,
        `/repos/${argocdOwner}/${argocdRepo}/contents/${encodedPath}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: `Create dynamic stand ${name}`,
            content: Buffer.from(content).toString('base64'),
            branch: 'main',
          }),
        },
      );
      ctx.output('fileUrl', result.content.html_url);
      ctx.logger.info(`Created ${path}`);
    },
  });
}

function createListContainerTagsAction(token: string) {
  return createTemplateAction({
    id: 'lh:dynamic-stand:list-tags',
    description:
      'Lists available GHCR tags for the images used by a dynamic stand.',
    schema: {
      output: {
        djangoTags: z => z.array(z.string()),
        frontTags: z => z.array(z.string()),
      },
    },
    async handler(ctx) {
      const [djangoTags, frontTags] = await Promise.all([
        getContainerTags(token, 'manara-development', 'core_backend-django'),
        getContainerTags(token, 'liquidityhub-finance', 'front_fsd'),
      ]);
      ctx.output('djangoTags', djangoTags);
      ctx.output('frontTags', frontTags);
      ctx.logger.info(`Django tags: ${djangoTags.join(', ')}`);
      ctx.logger.info(`Frontend tags: ${frontTags.join(', ')}`);
    },
  });
}

export const dynamicStandsModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'dynamic-stands',
  register({ registerInit }) {
    registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ config, httpRouter, scaffolder }) {
        const github = config
          .getConfigArray('integrations.github')
          .find(item => item.getString('host') === 'github.com');
        const token = github?.getOptionalString('token');
        if (!token) {
          throw new Error(
            'integrations.github token is required for dynamic stands.',
          );
        }
        scaffolder.addActions(
          createListContainerTagsAction(token),
          createDynamicStandAction(token),
        );
        httpRouter.addAuthPolicy({
          path: '/dynamic-stands',
          allow: 'user-cookie',
        });
        httpRouter.use(async (request, response, next) => {
          try {
            if (
              request.method === 'GET' &&
              request.path === '/dynamic-stands/tags'
            ) {
              const [djangoTags, frontTags] = await Promise.all([
                getContainerTags(
                  token,
                  'manara-development',
                  'core_backend-django',
                ),
                getContainerTags(token, 'liquidityhub-finance', 'front_fsd'),
              ]);
              response.json({ djangoTags, frontTags });
              return;
            }
            if (
              request.method === 'GET' &&
              request.path === '/dynamic-stands'
            ) {
              response.json({ stands: await listDynamicStands(token) });
              return;
            }
            const deleteMatch = request.path.match(
              /^\/dynamic-stands\/([^/]+)$/,
            );
            if (request.method === 'DELETE' && deleteMatch) {
              await deleteDynamicStand(
                token,
                decodeURIComponent(deleteMatch[1]),
              );
              response.status(204).end();
              return;
            }
            next();
          } catch (error) {
            next(error);
          }
        });
      },
    });
  },
});
