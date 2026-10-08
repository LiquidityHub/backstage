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
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import AppsIcon from '@material-ui/icons/Apps';
import AssessmentIcon from '@material-ui/icons/Assessment';
import LockIcon from '@material-ui/icons/Lock';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import StorageIcon from '@material-ui/icons/Storage';
import VpnKeyIcon from '@material-ui/icons/VpnKey';

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3, 4),
    marginBottom: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    background: 'linear-gradient(120deg, #142b42 0%, #146c6a 100%)',
  },
  heroText: {
    color: '#ffffff',
    maxWidth: 640,
  },
  heroActions: {
    marginTop: theme.spacing(3),
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  cardText: {
    minHeight: 56,
    marginBottom: theme.spacing(2),
  },
  platformTools: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
}));

export function PlatformHomePage() {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Header
        title="Liquidity Hub Platform"
        subtitle="Developer portal and dynamic test environments"
      />
      <Content>
        <section className={classes.hero}>
          <Typography className={classes.heroText} variant="h4">
            Ship and verify changes safely
          </Typography>
          <Typography className={classes.heroText} variant="body1">
            Create an isolated test stand from approved container tags, follow
            its Kubernetes status, and open the application when it is ready.
          </Typography>
          <div className={classes.heroActions}>
            <Button
              color="primary"
              href="/create/templates/default/create-dynamic-stand"
              startIcon={<AddCircleOutlineIcon />}
              variant="contained"
            >
              Create test stand
            </Button>
            <Button href="/dynamic-stands" variant="outlined">
              View test stands
            </Button>
          </div>
        </section>
        <Grid container spacing={3}>
          <Grid item md={4} xs={12}>
            <InfoCard title="Create a test stand">
              <Typography className={classes.cardText} variant="body2">
                Select Django and frontend image tags. Backstage creates the
                Argo CD environment and provisions its isolated dependencies.
              </Typography>
              <Button
                color="primary"
                href="/create/templates/default/create-dynamic-stand"
                startIcon={<AddCircleOutlineIcon />}
                variant="contained"
              >
                Create stand
              </Button>
            </InfoCard>
          </Grid>
          <Grid item md={4} xs={12}>
            <InfoCard title="Test stands">
              <Typography className={classes.cardText} variant="body2">
                See whether each declared environment is waiting, deploying,
                ready, or has a pod startup error.
              </Typography>
              <Button
                color="primary"
                href="/dynamic-stands"
                startIcon={<AppsIcon />}
                variant="outlined"
              >
                Open test stands
              </Button>
            </InfoCard>
          </Grid>
          <Grid item md={4} xs={12}>
            <InfoCard title="Software catalog">
              <Typography className={classes.cardText} variant="body2">
                Browse services, owners, APIs and operational context in the
                organization catalog.
              </Typography>
              <Button
                color="primary"
                href="/catalog"
                startIcon={<StorageIcon />}
                variant="outlined"
              >
                Open catalog
              </Button>
            </InfoCard>
          </Grid>
          <Grid item xs={12}>
            <InfoCard title="Platform tools">
              <Typography className={classes.cardText} variant="body2">
                Operational tools are available here for investigating logs,
                managing access, and working with secrets.
              </Typography>
              <div className={classes.platformTools}>
                <Button
                  color="primary"
                  endIcon={<OpenInNewIcon />}
                  href="https://grafana.tenv.online"
                  startIcon={<AssessmentIcon />}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                >
                  Grafana
                </Button>
                <Button
                  color="primary"
                  endIcon={<OpenInNewIcon />}
                  href="https://vault.tenv.online"
                  startIcon={<LockIcon />}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                >
                  Vault
                </Button>
                <Button
                  color="primary"
                  endIcon={<OpenInNewIcon />}
                  href="https://keycloak.tenv.online"
                  startIcon={<VpnKeyIcon />}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                >
                  Keycloak
                </Button>
              </div>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
