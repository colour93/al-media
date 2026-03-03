ALTER TABLE "video_files" ADD COLUMN "video_codec" varchar(64);
--> statement-breakpoint
ALTER TABLE "video_files" ADD COLUMN "audio_codec" varchar(64);
--> statement-breakpoint
ALTER TABLE "video_files" ADD COLUMN "mp4_moov_atom_offset" bigint;
--> statement-breakpoint
ALTER TABLE "video_files" ADD COLUMN "mp4_mdat_atom_offset" bigint;
--> statement-breakpoint
ALTER TABLE "video_files" ADD COLUMN "mp4_moov_before_mdat" boolean;
