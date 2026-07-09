variable "tenancy_ocid" {
  description = "OCI Tenancy OCID"
  type        = string
  sensitive   = true
}

variable "user_ocid" {
  description = "OCI User OCID"
  type        = string
  sensitive   = true
}

variable "fingerprint" {
  description = "OCI API Key Fingerprint"
  type        = string
  sensitive   = true
}

variable "private_key_path" {
  description = "Path to the OCI API private key file"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "OCI Region (e.g., ap-mumbai-1)"
  type        = string

  validation {
    condition     = length(var.region) > 0
    error_message = "Region must be specified."
  }
}

variable "compartment_ocid" {
  description = "OCI Compartment OCID where resources will be created"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "Public SSH key to access the compute instances"
  type        = string
  sensitive   = true
}

variable "instance_shape" {
  description = "OCI compute shape (A1.Flex is Always Free ARM)"
  default     = "VM.Standard.A1.Flex"
  type        = string
}

variable "operating_system" {
  description = "OS name filter for image lookup"
  default     = "Canonical Ubuntu"
  type        = string
}

variable "operating_system_version" {
  description = "OS version filter for image lookup"
  default     = "22.04"
  type        = string
}

variable "kubectl_access_cidr" {
  description = "CIDR range allowed to reach the K8s API (port 6443). Use your GitHub Actions IPs or admin IP. Default: allow nowhere — set explicitly."
  type        = string
  default     = "0.0.0.0/0" # Override in tfvars for production hardening
}
