ALTER TABLE "ticket_orders" ADD COLUMN "customer_access_token_hash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_order_idempotency_idx" ON "ticket_orders" USING btree ("organization_id","idempotency_key");
