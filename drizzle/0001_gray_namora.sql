CREATE TABLE "video_file_index_strategies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "video_file_index_strategies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mode" varchar(20) DEFAULT 'blacklist' NOT NULL,
	"file_dir_id" integer,
	"file_key_regex" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_file_index_strategies" ADD CONSTRAINT "video_file_index_strategies_file_dir_id_file_dirs_id_fk" FOREIGN KEY ("file_dir_id") REFERENCES "public"."file_dirs"("id") ON DELETE cascade ON UPDATE no action;