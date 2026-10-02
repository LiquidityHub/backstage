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

import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SwappableComponentBlueprint } from '@backstage/plugin-app-react';
import {
  FormFieldBlueprint,
  TemplateCard,
} from '@backstage/plugin-scaffolder-react/alpha';
import { DynamicStandTagPickerField } from './DynamicStandTagPicker';

const dynamicStandTagPickerFormField = FormFieldBlueprint.make({
  name: 'dynamic-stand-tag-picker',
  params: {
    field: () => Promise.resolve(DynamicStandTagPickerField),
  },
});

export const appModuleScaffolder = createFrontendModule({
  pluginId: 'app',
  extensions: [
    dynamicStandTagPickerFormField,
    SwappableComponentBlueprint.make({
      name: 'scaffolder-template-card',
      params: defineParams =>
        defineParams({
          component: TemplateCard,
          loader: () =>
            import('./BuiTemplateCard').then(m => m.BuiTemplateCard),
        }),
    }),
  ],
});
