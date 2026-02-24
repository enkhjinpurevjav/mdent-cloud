FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
  ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
COPY PosAPI.deb /tmp/PosAPI.deb
COPY deb/ /tmp/deb/

# Install the .deb and resolve dependencies
RUN apt-get update && apt-get install -y /tmp/PosAPI.deb || true && \
    apt-get install -y -f && \
    rm -rf /var/lib/apt/lists/* /tmp/*

EXPOSE 7080

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
