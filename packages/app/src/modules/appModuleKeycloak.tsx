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

import { OAuth2 } from '@backstage/core-app-api';
import {
  BackstageIdentityApi,
  OpenIdConnectApi,
  ProfileInfoApi,
  SessionApi,
} from '@backstage/core-plugin-api';
import {
  ApiBlueprint,
  configApiRef,
  createFrontendModule,
  createApiRef,
  discoveryApiRef,
  oauthRequestApiRef,
} from '@backstage/frontend-plugin-api';
import { SignInPage } from '@backstage/core-components';
import appPlugin from '@backstage/plugin-app';
import type { SignInPageProps } from '@backstage/plugin-app-react';

const keycloakAuthApiRef = createApiRef<
  OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>({
  id: 'auth.keycloak',
});

const keycloakAuthApi = ApiBlueprint.make({
  name: 'keycloak',
  params: defineParams =>
    defineParams({
      api: keycloakAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
        OAuth2.create({
          configApi,
          discoveryApi,
          oauthRequestApi,
          environment: configApi.getOptionalString('auth.environment'),
          provider: {
            id: 'keycloak',
            title: 'Keycloak',
            icon: () => null,
          },
          defaultScopes: ['openid', 'profile', 'email'],
        }),
    }),
});

/**
 * Shared by the main app and the public sign-in entrypoint so both use Keycloak.
 * The public entrypoint must obtain a Backstage identity before the cookie-auth
 * redirect can submit its token to the backend.
 */
export const appModuleKeycloak = createFrontendModule({
  pluginId: 'app',
  extensions: [
    keycloakAuthApi,
    appPlugin.getExtension('sign-in-page:app').override({
      params: {
        loader: async () => (props: SignInPageProps) =>
          (
            <SignInPage
              {...props}
              provider={{
                id: 'keycloak-auth-provider',
                title: 'Keycloak',
                message: 'Sign in using Keycloak',
                apiRef: keycloakAuthApiRef,
              }}
            />
          ),
      },
    }),
  ],
});
