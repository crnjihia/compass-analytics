.PHONY: setup dev test lint typecheck build seed simulate docker-up docker-down db-generate db-migrate db-seed clean

setup:
	pnpm install
	pnpm --filter @compass/db run generate

dev:
	pnpm dev

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

build:
	pnpm build

docker-up:
	docker compose up -d postgres redis

docker-down:
	docker compose down

db-generate:
	pnpm --filter @compass/db run generate

db-migrate:
	pnpm --filter @compass/db run migrate

db-seed:
	pnpm --filter @compass/db run seed

seed: db-seed

simulate:
	cd services/ingest && go run ./cmd/simulator -tps 5 -duration 30s

clean:
	pnpm clean
