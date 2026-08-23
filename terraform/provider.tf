terraform {
  # pin Terraform core version for reproducible plan/apply behaviour
  required_version = "~> 1.9"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # ── Remote state (RECOMMENDED — uncomment after creating the bucket) ──
  # Local state stores sensitive outputs (k3s_token, instance IPs) in plaintext
  # on disk with no locking. Migrate to an OCI Object Storage bucket via its
  # S3-compatibility layer:
  #
  # backend "s3" {
  #   bucket                      = "linksnap-terraform-state"
  #   key                         = "infra/terraform.tfstate"
  #   region                      = "ap-mumbai-1"
  #   endpoint                    = "https://linksnap-terraform-state.compat.objectstorage.ap-mumbai-1.oraclecloud.com"
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_metadata_api_check     = true
  #   force_path_style            = true
  #   access_key                  = "<OCI customer secret key id>"
  #   secret_key                  = "<OCI customer secret key>"
  # }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}
