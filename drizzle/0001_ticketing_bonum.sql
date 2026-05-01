DO $$ BEGIN
	CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'qpay', 'bank', 'bonum');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."payment_provider" ADD VALUE IF NOT EXISTS 'bonum';--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."ticket_order_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'expired');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'MNT' NOT NULL,
	"capacity" integer,
	"sold_count" integer DEFAULT 0 NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"max_per_order" integer DEFAULT 10 NOT NULL,
	"sale_starts_at" timestamp,
	"sale_ends_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchaser_name" varchar(255) NOT NULL,
	"purchaser_email" varchar(255) NOT NULL,
	"purchaser_phone" varchar(50),
	"purchaser_company" varchar(255),
	"status" "ticket_order_status" DEFAULT 'pending' NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'MNT' NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_invoice_id" varchar(255),
	"provider_transaction_id" varchar(100) NOT NULL,
	"checkout_url" text,
	"quantity" integer NOT NULL,
	"idempotency_key" varchar(255),
	"metadata" jsonb,
	"expires_at" timestamp,
	"paid_at" timestamp,
	"fulfilled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"ticket_type_name" varchar(255) NOT NULL,
	"ticket_type_slug" varchar(100) NOT NULL,
	"unit_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'MNT' NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_edition_id_event_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."event_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_edition_id_event_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."event_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_order_items" ADD CONSTRAINT "ticket_order_items_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_order_items" ADD CONSTRAINT "ticket_order_items_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "ticket_order_id" uuid;--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "ticket_order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_ticket_order_id_ticket_orders_id_fk" FOREIGN KEY ("ticket_order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_ticket_order_item_id_ticket_order_items_id_fk" FOREIGN KEY ("ticket_order_item_id") REFERENCES "public"."ticket_order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_type_edition_idx" ON "ticket_types" USING btree ("edition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_type_edition_slug_idx" ON "ticket_types" USING btree ("edition_id","slug");--> statement-breakpoint
CREATE INDEX "ticket_order_edition_idx" ON "ticket_orders" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "ticket_order_org_status_idx" ON "ticket_orders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_order_provider_invoice_idx" ON "ticket_orders" USING btree ("provider","provider_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_order_provider_transaction_idx" ON "ticket_orders" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "ticket_order_item_order_idx" ON "ticket_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_order_item_type_idx" ON "ticket_order_items" USING btree ("ticket_type_id");
