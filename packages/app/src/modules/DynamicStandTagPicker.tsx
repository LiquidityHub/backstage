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
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  FieldExtensionComponentProps,
  makeFieldSchema,
} from '@backstage/plugin-scaffolder-react';
import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { useEffect, useState } from 'react';

type Image = 'django' | 'front';

type TagPickerOptions = { image: Image };

const tagsCache: Partial<Record<Image, string[]>> = {};

function DynamicStandTagPicker(
  props: FieldExtensionComponentProps<string, TagPickerOptions>,
) {
  const {
    formData,
    onChange,
    rawErrors,
    required,
    schema,
    uiSchema,
    idSchema,
  } = props;
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const image = uiSchema['ui:options']?.image ?? 'django';
  const [tags, setTags] = useState<string[]>(tagsCache[image] ?? []);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    async function loadTags() {
      try {
        const credentials = await identityApi.getCredentials();
        const baseUrl = await discoveryApi.getBaseUrl('scaffolder');
        const response = await fetch(`${baseUrl}/dynamic-stands/tags`, {
          headers: credentials.token
            ? { Authorization: `Bearer ${credentials.token}` }
            : undefined,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = (await response.json()) as {
          djangoTags: string[];
          frontTags: string[];
        };
        const loadedTags =
          image === 'django' ? result.djangoTags : result.frontTags;
        tagsCache[image] = loadedTags;
        if (active) setTags(loadedTags);
      } catch (loadError) {
        if (active) setError(`Unable to load GHCR tags: ${String(loadError)}`);
      }
    }
    if (!tagsCache[image]) {
      loadTags();
    }
    return () => {
      active = false;
    };
  }, [discoveryApi, identityApi, image]);

  return (
    <TextField
      select
      fullWidth
      id={idSchema?.$id}
      label={schema.title}
      helperText={error ?? schema.description}
      required={required}
      value={formData ?? ''}
      onChange={event => onChange(event.target.value)}
      margin="normal"
      error={Boolean(error) || (rawErrors?.length ?? 0) > 0}
      disabled={!tags.length && !error}
    >
      <MenuItem value="" disabled>
        {tags.length ? 'Select a tag' : 'Loading tags…'}
      </MenuItem>
      {tags.map(tag => (
        <MenuItem key={tag} value={tag}>
          {tag}
        </MenuItem>
      ))}
    </TextField>
  );
}

const DynamicStandTagPickerFieldSchema = makeFieldSchema({
  output: z => z.string(),
  uiOptions: z => z.object({ image: z.enum(['django', 'front']) }),
});

export const DynamicStandTagPickerField = createFormField({
  name: 'DynamicStandTagPicker',
  component: DynamicStandTagPicker,
  schema: DynamicStandTagPickerFieldSchema,
});
