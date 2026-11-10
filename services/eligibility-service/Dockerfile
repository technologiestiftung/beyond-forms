# Build context is the repository root, see .github/workflows/reusable-service-pipeline.yaml
FROM node:24-slim AS builder

WORKDIR /app

COPY libs/eligibility-engine/package.json libs/eligibility-engine/package-lock.json ./libs/eligibility-engine/
RUN npm ci --omit=dev --prefix ./libs/eligibility-engine

COPY libs/eligibility-engine/src ./libs/eligibility-engine/src
COPY knowledge ./knowledge
COPY services/eligibility-service ./services/eligibility-service

FROM builder AS test
WORKDIR /app/services/eligibility-service
RUN npm test

FROM builder AS production
# Ensure tests passed by copying a file from the test stage
COPY --from=test /app/services/eligibility-service/package.json /dev/null
WORKDIR /app/services/eligibility-service
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "src/server.ts"]
