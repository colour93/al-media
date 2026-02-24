CREATE TYPE "public"."creator_platform" AS ENUM('onlyfans', 'justforfans', 'fansone', 'fansonly');--> statement-breakpoint
CREATE TYPE "public"."creator_type" AS ENUM('person', 'group');--> statement-breakpoint
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
ALTER TABLE "creator_tags" ADD CONSTRAINT "creator_tags_creatorId_creators_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_tags" ADD CONSTRAINT "creator_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_actorId_actors_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tagTypeId_tag_types_id_fk" FOREIGN KEY ("tagTypeId") REFERENCES "public"."tag_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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