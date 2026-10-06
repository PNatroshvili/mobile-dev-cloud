FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
ENV CI=false
ENV EXPO_NO_TELEMETRY=1

EXPOSE 8081 3000 19000 19001 19002
CMD ["bash"]
