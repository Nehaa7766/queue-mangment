-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('RECEPTION', 'DOCTOR');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('PATIENT', 'STAFF');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('SENDING', 'DONE');

-- CreateEnum
CREATE TYPE "BroadcastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "unread_by_staff" INTEGER NOT NULL DEFAULT 0,
    "unread_by_patient" INTEGER NOT NULL DEFAULT 0,
    "staff_read_at" TIMESTAMP(3),
    "patient_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "sender_user_id" UUID,
    "body" VARCHAR(1000) NOT NULL,
    "client_message_id" VARCHAR(64) NOT NULL,
    "broadcast_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "body" VARCHAR(1000) NOT NULL,
    "service_ids" UUID[],
    "status" "BroadcastStatus" NOT NULL DEFAULT 'SENDING',
    "total_recipients" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" UUID NOT NULL,
    "broadcast_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "status" "BroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "conversation_id" UUID,
    "message_id" UUID,
    "skip_reason" VARCHAR(40),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(300),
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_clinic_id_channel_last_message_at_idx" ON "conversations"("clinic_id", "channel", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_token_id_channel_key" ON "conversations"("token_id", "channel");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_clinic_id_created_at_idx" ON "messages"("clinic_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_client_message_id_key" ON "messages"("conversation_id", "client_message_id");

-- CreateIndex
CREATE INDEX "broadcasts_clinic_id_created_at_idx" ON "broadcasts"("clinic_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "broadcasts_clinic_id_idempotency_key_key" ON "broadcasts"("clinic_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcast_id_status_idx" ON "broadcast_recipients"("broadcast_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcast_id_token_id_key" ON "broadcast_recipients"("broadcast_id", "token_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "queue_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "queue_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
