resource "oci_core_vcn" "linksnap_vcn" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-vcn"
  cidr_block     = "10.0.0.0/16"
  dns_label      = "linksnap"
}

# ─── INTERNET GATEWAY (For Public Subnet) ──────────────────────────────────────
resource "oci_core_internet_gateway" "linksnap_ig" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-internet-gateway"
  vcn_id         = oci_core_vcn.linksnap_vcn.id
}

# ─── NAT GATEWAY (For Private Subnet Outbound) ─────────────────────────────────
resource "oci_core_nat_gateway" "linksnap_nat" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-nat-gateway"
  vcn_id         = oci_core_vcn.linksnap_vcn.id
}

# ─── ROUTE TABLES ──────────────────────────────────────────────────────────────
resource "oci_core_route_table" "public_rt" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-public-rt"
  vcn_id         = oci_core_vcn.linksnap_vcn.id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.linksnap_ig.id
  }
}

resource "oci_core_route_table" "private_rt" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-private-rt"
  vcn_id         = oci_core_vcn.linksnap_vcn.id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_nat_gateway.linksnap_nat.id
  }
}

# ─── SECURITY LISTS ────────────────────────────────────────────────────────────
resource "oci_core_security_list" "public_sl" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-public-sl"
  vcn_id         = oci_core_vcn.linksnap_vcn.id

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  # SSH from Internet
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  # HTTP
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  # HTTPS
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  # Kubernetes API — restricted to VPC internal only (GitHub Actions must use tunnel or bastion)
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "10.0.0.0/16"
    tcp_options {
      min = 6443
      max = 6443
    }
  }

  # Kubernetes API — from GitHub Actions runner IPs (add your CI IP range or manage via VPN)
  ingress_security_rules {
    protocol = "6" # TCP
    source   = var.kubectl_access_cidr
    tcp_options {
      min = 6443
      max = 6443
    }
  }
  
  # Allow all internal VPC traffic
  ingress_security_rules {
    protocol = "all"
    source   = "10.0.0.0/16"
  }
}

resource "oci_core_security_list" "private_sl" {
  compartment_id = var.compartment_ocid
  display_name   = "linksnap-private-sl"
  vcn_id         = oci_core_vcn.linksnap_vcn.id

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  # Allow all internal VPC traffic (from public subnet and other private instances)
  ingress_security_rules {
    protocol = "all"
    source   = "10.0.0.0/16"
  }
}

# ─── SUBNETS ───────────────────────────────────────────────────────────────────
resource "oci_core_subnet" "public_subnet" {
  compartment_id    = var.compartment_ocid
  display_name      = "linksnap-public-subnet"
  vcn_id            = oci_core_vcn.linksnap_vcn.id
  cidr_block        = "10.0.1.0/24"
  route_table_id    = oci_core_route_table.public_rt.id
  security_list_ids = [oci_core_security_list.public_sl.id]
  dns_label         = "pub"
}

resource "oci_core_subnet" "private_subnet" {
  compartment_id             = var.compartment_ocid
  display_name               = "linksnap-private-subnet"
  vcn_id                     = oci_core_vcn.linksnap_vcn.id
  cidr_block                 = "10.0.2.0/24"
  route_table_id             = oci_core_route_table.private_rt.id
  security_list_ids          = [oci_core_security_list.private_sl.id]
  prohibit_public_ip_on_vnic = true
  dns_label                  = "priv"
}
