FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
COPY PosAPI.deb /tmp/PosAPI.deb
COPY deb/ /tmp/deb/

# Install without running postinst (because it calls systemctl)
RUN set -eux; \
  apt-get update; \
  dpkg --unpack /tmp/PosAPI.deb; \
  apt-get install -y -f; \
  dpkg --configure -a --force-confnew --force-confdef --force-not-root --force-bad-path || true; \
  rm -rf /var/lib/apt/lists/* /tmp/*
