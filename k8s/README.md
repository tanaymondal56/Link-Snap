# Link-Snap Kubernetes deployment

This directory follows the architecture in `plans/k8s/system_design.md`:

`Cloudflare Pages Function -> Cloudflare Access -> cloudflared -> linksnap-backend-service`

The backend service is `ClusterIP`; do not create a public LoadBalancer or open HTTP/HTTPS ports on the host. Cloudflare Tunnel is the only ingress path.

## Deploy the BFF/tunnel topology

1. Create the namespace and application secret. Do not apply `secrets.yaml.template` with its placeholder values.

   ```sh
   kubectl apply -f k8s/namespace.yaml
   kubectl create secret generic linksnap-secrets --namespace=linksnap \
     --from-literal=MONGO_URI='...' \
     --from-literal=REDIS_PASSWORD='<hex-only-random-value>' \
     --from-literal=REDIS_URL='redis://default:<same-hex-value>@redis-local-service.linksnap.svc.cluster.local:6379' \
     --from-literal=JWT_ACCESS_SECRET='...' \
     --from-literal=JWT_REFRESH_SECRET='...' \
     --from-literal=SESSION_SECRET='...' \
     --from-literal=ENCRYPTION_KEY='...'
   ```

2. Create a remotely managed Cloudflare Tunnel and save its token only in Kubernetes.

   ```sh
   kubectl create secret generic cloudflare-tunnel-secret --namespace=linksnap \
     --from-literal=tunnel-token='...'
   ```

3. If the backend image is private, create the GHCR pull secret required by the Deployment.

   ```sh
   kubectl create secret docker-registry ghcr-credentials --namespace=linksnap \
     --docker-server=ghcr.io \
     --docker-username='<github-username>' \
     --docker-password='<PAT-with-read-packages>' \
     --docker-email='<email>'
   ```

4. Set the Cloudflare Tunnel public hostname for the protected API to `http://linksnap-backend-service.linksnap.svc.cluster.local:5000`. Protect that hostname with a Cloudflare Access **Service Auth** policy. The Pages Function at `client/functions/api/[[path]].js` must be deployed with the Pages frontend and given `CF_API_ORIGIN`, `CF_ACCESS_CLIENT_ID`, and `CF_ACCESS_CLIENT_SECRET` as encrypted Pages variables. Browsers must never receive those credentials.

5. Apply and wait for rollout.

   ```sh
   kubectl apply -k k8s
   kubectl rollout status deployment/linksnap-backend -n linksnap
   kubectl rollout status deployment/cloudflared-tunnel -n linksnap
   kubectl get all -n linksnap
   ```

The `frontend-*`, `ingress.yaml`, and `cert-manager-issuer.yaml` manifests are retained for the former in-cluster/frontend-ingress topology. They are intentionally not part of `kustomization.yaml`, because the Cloudflare Pages BFF design does not require an inbound NGINX ingress or Let's Encrypt HTTP challenge.

## Local TCP Redis

`redis-local.yaml` is an internal, password-protected, ephemeral cache and is included in the default Kustomize deployment. The backend prefers `REDIS_URL` (TCP) and falls back to Upstash only when it is absent.

Add both values to `linksnap-secrets` before the initial deployment:

```text
REDIS_PASSWORD=<strong random value>
REDIS_URL=redis://default:<URL-encoded REDIS_PASSWORD>@redis-local-service.linksnap.svc.cluster.local:6379
```

The initial `kubectl apply -k k8s` deploys Redis and the backend together. To apply a Redis-only change later:

```sh
kubectl apply -f k8s/redis-local.yaml
kubectl rollout restart deployment/linksnap-backend -n linksnap
```

Do not expose the Redis service publicly. Its contents are cache data only; MongoDB remains authoritative.
