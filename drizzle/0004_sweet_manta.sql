ALTER TABLE "articles" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "excerpt" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "author_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "featured_image" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "deleted_at" timestamp;