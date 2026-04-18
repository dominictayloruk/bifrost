import { z } from "zod";
import { envVarSchema, isEnvVarSet } from "@/lib/types/schemas";

const requiredEnvVar = (message: string) => envVarSchema.refine(isEnvVarSet, { message });

const redisSchema = z.object({
	provider: z.literal("redis"),
	addr: requiredEnvVar("Redis address is required"),
});

const weaviateSchema = z.object({
	provider: z.literal("weaviate"),
	host: requiredEnvVar("Weaviate host is required"),
});

const qdrantSchema = z.object({
	provider: z.literal("qdrant"),
	host: requiredEnvVar("Qdrant host is required"),
});

const pineconeSchema = z.object({
	provider: z.literal("pinecone"),
	api_key: requiredEnvVar("Pinecone API key is required"),
	index_host: requiredEnvVar("Pinecone index host is required"),
});

export const vectorStoreFormSchema = z.discriminatedUnion("provider", [redisSchema, weaviateSchema, qdrantSchema, pineconeSchema]);