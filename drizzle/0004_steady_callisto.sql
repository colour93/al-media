ALTER TABLE "video_files" ADD COLUMN "source_video_file_id" integer;--> statement-breakpoint
ALTER TABLE "video_files" ADD CONSTRAINT "video_files_source_video_file_id_video_files_id_fk" FOREIGN KEY ("source_video_file_id") REFERENCES "public"."video_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preferred_video_file_id" integer;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_preferred_video_file_id_video_files_id_fk" FOREIGN KEY ("preferred_video_file_id") REFERENCES "public"."video_files"("id") ON DELETE set null ON UPDATE no action;
