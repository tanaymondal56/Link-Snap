data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

data "oci_core_images" "ubuntu_images" {
  compartment_id           = var.compartment_ocid
  operating_system         = var.operating_system
  operating_system_version = var.operating_system_version
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"

  filter {
    name   = "state"
    values = ["AVAILABLE"]
  }
}

# Generate a secure pre-shared token for K3s nodes to communicate
resource "random_password" "k3s_token" {
  length  = 64
  special = false
}

# ─── FRONTEND NODE (Master / Control Plane / Ingress) ──────────────────────────
# Specs: 1 OCPU, 4GB RAM — OCI A1.Flex Always Free
resource "oci_core_instance" "linksnap_frontend_node" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = "linksnap-k3s-frontend"
  shape               = var.instance_shape

  shape_config {
    ocpus         = 1
    memory_in_gbs = 4
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public_subnet.id
    display_name     = "frontend-vnic"
    assign_public_ip = true
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_images.images[0].id
    boot_volume_size_in_gbs = 50
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(<<-EOF
#!/bin/bash
set -euo pipefail
exec >> /var/log/k3s-cloud-init.log 2>&1
echo "[$(date)] Starting LinkSnap Frontend Node cloud-init..."

# 1. Install iptables-persistent and open required ports
apt-get update -y
apt-get install -y iptables-persistent netfilter-persistent

iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 6443 -j ACCEPT
netfilter-persistent save

# 2. Install K3s Server (disable Traefik; Nginx Ingress handles routing)
echo "[$(date)] Installing K3s server..."
sleep 15
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --write-kubeconfig-mode 644" K3S_TOKEN="${random_password.k3s_token.result}" sh -

# 3. Wait for K3s to be fully ready before proceeding
echo "[$(date)] Waiting for K3s to be Ready..."
until kubectl get nodes | grep -q ' Ready'; do
  echo "[$(date)] K3s not ready yet, retrying in 5s..."
  sleep 5
done

# 4. Give standard user access to kubectl
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
sed -i 's/127.0.0.1/localhost/g' /home/ubuntu/.kube/config
chown -R ubuntu:ubuntu /home/ubuntu/.kube
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 5. Install Nginx Ingress Controller (baremetal — no cloud LB needed)
echo "[$(date)] Installing Nginx Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/baremetal/deploy.yaml

# 6. Install Cert-Manager
echo "[$(date)] Installing Cert-Manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.3/cert-manager.yaml

echo "[$(date)] Frontend node cloud-init complete!"
EOF
    )
  }
}

# ─── BACKEND NODE (Worker / Agent) ─────────────────────────────────────────────
# Specs: 2 OCPUs, 8GB RAM — OCI A1.Flex Always Free
# NOTE: This node is on a private subnet — no inbound internet access.
#       Outbound traffic routes via NAT Gateway.
#       Total A1.Flex budget used: 3 OCPUs + 12GB RAM (Always Free limit: 4 OCPUs + 24GB)
resource "oci_core_instance" "linksnap_backend_node" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = "linksnap-k3s-backend"
  shape               = var.instance_shape

  shape_config {
    ocpus         = 2
    memory_in_gbs = 8
  }

  create_vnic_details {
    subnet_id                 = oci_core_subnet.private_subnet.id
    display_name              = "backend-vnic"
    assign_public_ip          = false
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_images.images[0].id
    boot_volume_size_in_gbs = 50
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(<<-EOF
#!/bin/bash
set -euo pipefail
exec >> /var/log/k3s-cloud-init.log 2>&1
echo "[$(date)] Starting LinkSnap Backend Node cloud-init..."

# 1. Install iptables-persistent for internal cluster comms
apt-get update -y
apt-get install -y iptables-persistent netfilter-persistent netcat-openbsd

iptables -I INPUT 6 -m state --state NEW -p tcp --dport 10250 -j ACCEPT
netfilter-persistent save

# 2. Wait for the K3s API server on the frontend node to be ready
echo "[$(date)] Waiting for K3s API server at ${oci_core_instance.linksnap_frontend_node.private_ip}:6443..."
until nc -z ${oci_core_instance.linksnap_frontend_node.private_ip} 6443; do
  echo "[$(date)] API server not reachable yet, retrying in 10s..."
  sleep 10
done
echo "[$(date)] K3s API server is reachable. Joining cluster..."

# 3. Install K3s Agent and join the master node
curl -sfL https://get.k3s.io | \
  K3S_URL="https://${oci_core_instance.linksnap_frontend_node.private_ip}:6443" \
  K3S_TOKEN="${random_password.k3s_token.result}" \
  sh -

echo "[$(date)] Backend node joined K3s cluster successfully!"
EOF
    )
  }

  # Ensure frontend boots and is assigned an IP before backend tries to connect
  depends_on = [oci_core_instance.linksnap_frontend_node]
}
