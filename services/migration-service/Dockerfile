FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY /services/migration-service /app
RUN go mod download

# Build the Go application
RUN CGO_ENABLED=0 GOOS=linux go build -o migration-service main.go

FROM builder AS test
RUN go vet ./... && go test ./...

# Standard Alpine runner
FROM alpine:latest
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN adduser -D -u 10001 appuser

WORKDIR /app

# Copy the binary and migrations directory
COPY --from=builder --chown=appuser:appuser /app/migration-service .

USER appuser

CMD ["./migration-service"]
