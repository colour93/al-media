CREATE TYPE "public"."creator_platform" AS ENUM('onlyfans', 'justforfans', 'fansone', 'fansonly');--> statement-breakpoint
CREATE TYPE "public"."creator_type" AS ENUM('person', 'group');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "actor_tags" (
	"actorId" integer NOT NULL,
	"tagId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "actors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"avatarKey" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "binding_strategies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "binding_strategies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" varchar(20) NOT NULL,
	"file_dir_id" integer NOT NULL,
	"folder_path" varchar,
	"filename_regex" varchar,
	"tag_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"creator_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"actor_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_tags" (
	"creatorId" integer NOT NULL,
	"tagId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "creators_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"actorId" integer,
	"type" "creator_type" NOT NULL,
	"platform" "creator_platform",
	"platformId" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distributors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "distributors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"domain" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_dirs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "file_dirs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"path" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_dirs_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "tag_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tag_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"icon" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"tagTypeId" integer NOT NULL,
	"color" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorite_videos" (
	"user_id" integer NOT NULL,
	"video_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorite_videos_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "user_video_histories" (
	"user_id" integer NOT NULL,
	"video_id" integer NOT NULL,
	"progress_seconds" integer DEFAULT 0 NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"last_played_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_video_histories_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"oidc_sub" varchar NOT NULL,
	"email" varchar,
	"name" varchar,
	"role" "user_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub")
);
--> statement-breakpoint
CREATE TABLE "video_actors" (
	"videoId" integer NOT NULL,
	"actorId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_creators" (
	"videoId" integer NOT NULL,
	"creatorId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_distributors" (
	"videoId" integer NOT NULL,
	"distributorId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_file_uniques" (
	"uniqueId" varchar PRIMARY KEY NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "video_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fileDirId" integer,
	"fileKey" varchar NOT NULL,
	"uniqueId" varchar NOT NULL,
	"file_size" bigint NOT NULL,
	"fileModifiedAt" timestamp NOT NULL,
	"video_duration" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_tags" (
	"videoId" integer NOT NULL,
	"tagId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_unique_contents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "video_unique_contents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"videoId" integer NOT NULL,
	"uniqueId" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar NOT NULL,
	"thumbnailKey" varchar,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"isBanner" boolean DEFAULT false NOT NULL,
	"bannerOrder" integer,
	"recommendedOrder" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actor_tags" ADD CONSTRAINT "actor_tags_actorId_actors_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_tags" ADD CONSTRAINT "actor_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binding_strategies" ADD CONSTRAINT "binding_strategies_file_dir_id_file_dirs_id_fk" FOREIGN KEY ("file_dir_id") REFERENCES "public"."file_dirs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_tags" ADD CONSTRAINT "creator_tags_creatorId_creators_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_tags" ADD CONSTRAINT "creator_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_actorId_actors_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tagTypeId_tag_types_id_fk" FOREIGN KEY ("tagTypeId") REFERENCES "public"."tag_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_videos" ADD CONSTRAINT "user_favorite_videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_videos" ADD CONSTRAINT "user_favorite_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_video_histories" ADD CONSTRAINT "user_video_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_video_histories" ADD CONSTRAINT "user_video_histories_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_actors" ADD CONSTRAINT "video_actors_videoId_videos_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_actors" ADD CONSTRAINT "video_actors_actorId_actors_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_creators" ADD CONSTRAINT "video_creators_videoId_videos_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_creators" ADD CONSTRAINT "video_creators_creatorId_creators_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_distributors" ADD CONSTRAINT "video_distributors_videoId_videos_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_distributors" ADD CONSTRAINT "video_distributors_distributorId_distributors_id_fk" FOREIGN KEY ("distributorId") REFERENCES "public"."distributors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_files" ADD CONSTRAINT "video_files_fileDirId_file_dirs_id_fk" FOREIGN KEY ("fileDirId") REFERENCES "public"."file_dirs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_files" ADD CONSTRAINT "video_files_uniqueId_video_file_uniques_uniqueId_fk" FOREIGN KEY ("uniqueId") REFERENCES "public"."video_file_uniques"("uniqueId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_videoId_videos_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_unique_contents" ADD CONSTRAINT "video_unique_contents_videoId_videos_id_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_unique_contents" ADD CONSTRAINT "video_unique_contents_uniqueId_video_file_uniques_uniqueId_fk" FOREIGN KEY ("uniqueId") REFERENCES "public"."video_file_uniques"("uniqueId") ON DELETE cascade ON UPDATE no action;