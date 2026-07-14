output "frontend_public_ip" {
  description = "Public IP of the LinkSnap Frontend/Edge K3s Node"
  value       = oci_core_instance.linksnap_frontend_node.public_ip
}

output "backend_private_ip" {
  description = "Private IP of the LinkSnap Backend K3s Worker Node"
  value       = oci_core_instance.linksnap_backend_node.private_ip
}

output "ssh_frontend" {
  description = "SSH command for the frontend (public) node"
  value       = "ssh -i <path_to_private_key> ubuntu@${oci_core_instance.linksnap_frontend_node.public_ip}"
}

output "ssh_backend" {
  description = "SSH to backend via frontend as jump host (private node has no public IP)"
  value       = "ssh -J ubuntu@${oci_core_instance.linksnap_frontend_node.public_ip} ubuntu@${oci_core_instance.linksnap_backend_node.private_ip}"
}

output "k3s_token" {
  description = "K3s cluster join token (sensitive — for adding extra nodes later)"
  value       = random_password.k3s_token.result
  sensitive   = true
}

output "kubeconfig_instructions" {
  description = "How to retrieve your KUBE_CONFIG for GitHub Actions"
  value       = <<EOF
1. SSH into the FRONTEND node:
   ssh ubuntu@${oci_core_instance.linksnap_frontend_node.public_ip}

2. Wait for K3s to be ready (may take 2-5 mins after first boot):
   kubectl get nodes

3. Retrieve the base64 encoded kubeconfig (replace 127.0.0.1 with the public IP first):
   sed 's/127.0.0.1/${oci_core_instance.linksnap_frontend_node.public_ip}/g' ~/.kube/config | base64 -w0

4. Paste the output as the KUBE_CONFIG GitHub Actions secret.
EOF
}
