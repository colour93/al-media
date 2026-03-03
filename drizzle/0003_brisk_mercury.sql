ALTER TABLE "binding_strategies" ADD COLUMN "distributor_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL;
