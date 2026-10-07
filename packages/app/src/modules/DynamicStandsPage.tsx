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

import { Content, Header, InfoCard, Page } from '@backstage/core-components';
import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Chip from '@material-ui/core/Chip';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Link from '@material-ui/core/Link';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Alert from '@material-ui/lab/Alert';
import { useCallback, useEffect, useState } from 'react';

type DynamicStand = {
  name: string;
  appUrl: string;
  apiUrl: string;
  fileUrl: string;
  status?: {
    phase: 'declared' | 'deploying' | 'ready' | 'error' | 'unknown';
    message: string;
    pods: { total: number; ready: number };
    logs?: { api?: string; frontend?: string };
  };
};

const statusColor = {
  declared: '#78909c',
  deploying: '#f9a825',
  ready: '#43a047',
  error: '#e53935',
  unknown: '#78909c',
};

const statusLabel = {
  declared: 'Declared',
  deploying: 'Deploying',
  ready: 'Ready',
  error: 'Error',
  unknown: 'Unknown',
};

async function responseError(response: Response) {
  const body = await response.text();
  return body || `HTTP ${response.status}`;
}

export function DynamicStandsPage() {
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const [stands, setStands] = useState<DynamicStand[]>();
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [standToDelete, setStandToDelete] = useState<DynamicStand>();

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const [baseUrl, credentials] = await Promise.all([
        discoveryApi.getBaseUrl('scaffolder'),
        identityApi.getCredentials(),
      ]);
      return fetch(`${baseUrl}${path}`, {
        ...init,
        headers: credentials.token
          ? { Authorization: `Bearer ${credentials.token}`, ...init?.headers }
          : init?.headers,
      });
    },
    [discoveryApi, identityApi],
  );

  const loadStands = useCallback(async () => {
    setError(undefined);
    try {
      const response = await request('/dynamic-stands');
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as { stands: DynamicStand[] };
      setStands(result.stands);
    } catch (loadError) {
      setError(`Unable to load dynamic stands: ${String(loadError)}`);
    }
  }, [request]);

  useEffect(() => {
    loadStands();
  }, [loadStands]);

  const deleteStand = async () => {
    const stand = standToDelete;
    if (!stand) return;
    setDeleting(stand.name);
    setError(undefined);
    try {
      const response = await request(`/dynamic-stands/${stand.name}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await responseError(response));
      await loadStands();
    } catch (deleteError) {
      setError(`Unable to delete ${stand.name}: ${String(deleteError)}`);
    } finally {
      setDeleting(undefined);
      setStandToDelete(undefined);
    }
  };

  return (
    <Page themeId="tool">
      <Header title="Test stands" subtitle="Active dynamic environments" />
      <Content>
        <InfoCard
          title="Dynamic stands"
          action={
            <>
              <Button
                color="primary"
                href="/create/templates/default/create-dynamic-stand"
                variant="contained"
              >
                Create stand
              </Button>
              <Button onClick={loadStands}>Refresh</Button>
            </>
          }
        >
          {error && <Alert severity="error">{error}</Alert>}
          {!stands && !error && <CircularProgress />}
          {stands && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Stand</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Application</TableCell>
                  <TableCell>API</TableCell>
                  <TableCell>Logs</TableCell>
                  <TableCell>Configuration</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stands.map(stand => (
                  <TableRow key={stand.name}>
                    <TableCell>{stand.name}</TableCell>
                    <TableCell title={stand.status?.message}>
                      <Chip
                        label={
                          stand.status
                            ? `${statusLabel[stand.status.phase]} (${
                                stand.status.pods.ready
                              }/${stand.status.pods.total})`
                            : 'Unknown'
                        }
                        size="small"
                        style={{
                          backgroundColor:
                            statusColor[stand.status?.phase ?? 'unknown'],
                          color: '#fff',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={stand.appUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open app
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={stand.apiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open API
                      </Link>
                    </TableCell>
                    <TableCell>
                      {stand.status?.logs?.api && (
                        <Link
                          href={stand.status.logs.api}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          API
                        </Link>
                      )}
                      {stand.status?.logs?.api &&
                        stand.status?.logs?.frontend &&
                        ' · '}
                      {stand.status?.logs?.frontend && (
                        <Link
                          href={stand.status.logs.frontend}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Frontend
                        </Link>
                      )}
                      {!stand.status?.logs?.api &&
                        !stand.status?.logs?.frontend &&
                        '—'}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={stand.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        YAML
                      </Link>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        color="secondary"
                        disabled={deleting === stand.name}
                        onClick={() => setStandToDelete(stand)}
                      >
                        {deleting === stand.name ? 'Deleting…' : 'Delete'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {stands.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>No active dynamic stands.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </InfoCard>
      </Content>
      <Dialog
        open={Boolean(standToDelete)}
        onClose={() => setStandToDelete(undefined)}
      >
        <DialogTitle>Delete dynamic stand?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {standToDelete
              ? `The ${standToDelete.name} configuration will be deleted. Argo CD will prune its resources.`
              : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStandToDelete(undefined)}>Cancel</Button>
          <Button color="secondary" onClick={deleteStand}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
