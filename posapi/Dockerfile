FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/*

# Stub systemctl so posapi.postinst doesn't fail in a container (no systemd)
RUN printf '#!/bin/sh\nexit 0\n' > /bin/systemctl && chmod +x /bin/systemctl

WORKDIR /tmp
COPY PosAPI.deb /tmp/PosAPI.deb
COPY deb/ /tmp/deb/

RUN set -eux; \
  apt-get update; \
  dpkg -i /tmp/PosAPI.deb || true; \
  apt-get install -y -f; \
  rm -rf /var/lib/apt/lists/* /tmp/*

EXPOSE 7080

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
