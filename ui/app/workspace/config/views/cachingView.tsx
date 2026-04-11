"use client";

import { Button } from "@/components/ui/button";
import { EnvVarInput } from "@/components/ui/envVarInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	getErrorMessage,
	useGetCoreConfigQuery,
	useGetVectorStoreConfigQuery,
	useUpdateVectorStoreConfigMutation,
} from "@/lib/store";
import { EnvVar } from "@/lib/types/schemas";
import { Loader2, Plug, Server } from "lucide-react";
import { useState } from "react";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { toast } from "sonner";
import PluginsForm from "./pluginsForm";

type RedisFormState = {
	addr: EnvVar;
	db: EnvVar;
	pool_size: number;
	use_tls: EnvVar;
};

const emptyEnvVar: EnvVar = { value: "", env_var: "", from_env: false };

const defaultFormState: RedisFormState = {
	addr: { ...emptyEnvVar },
	db: { value: "0", env_var: "", from_env: false },
	pool_size: 10,
	use_tls: { ...emptyEnvVar },
};

export default function CachingView() {
	const { data: bifrostConfig, isLoading: configLoading, error: configError } = useGetCoreConfigQuery({ fromDB: true });
	const { data: vsConfig, isLoading: vsLoading } = useGetVectorStoreConfigQuery();
	const [updateVectorStoreConfig, { isLoading: isUpdating }] = useUpdateVectorStoreConfigMutation();
	const hasSettingsUpdateAccess = useRbac(RbacResource.Settings, RbacOperation.Update);

	const [enabled, setEnabled] = useState(false);
	const [formState, setFormState] = useState<RedisFormState>({ ...defaultFormState });
	const [serverState, setServerState] = useState<{
		enabled: boolean;
		formState: RedisFormState;
	} | null>(null);

	// Sync from server data
	if (vsConfig && !serverState) {
		const rc = vsConfig.type === "redis" ? vsConfig.config : null;
		const newState = {
			enabled: vsConfig.enabled,
			formState: {
				addr: (rc?.addr as EnvVar) ?? { ...emptyEnvVar },
				db: (rc?.db as EnvVar) ?? { value: "0", env_var: "", from_env: false },
				pool_size: (rc?.pool_size as number) ?? 10,
				use_tls: (rc?.use_tls as EnvVar) ?? { ...emptyEnvVar },
			},
		};
		setServerState(newState);
		setEnabled(newState.enabled);
		setFormState(newState.formState);
	}

	// Track changes against server state
	const hasChanges =
		serverState !== null &&
		(enabled !== serverState.enabled ||
			formState.addr.value !== serverState.formState.addr.value ||
			formState.db.value !== serverState.formState.db.value ||
			formState.pool_size !== serverState.formState.pool_size ||
			formState.use_tls.value !== serverState.formState.use_tls.value);

	const handleSave = async () => {
		if (!formState.addr.value?.trim()) {
			toast.error("Redis address is required");
			return;
		}
		try {
			await updateVectorStoreConfig({
				enabled,
				type: "redis",
				config: {
					addr: formState.addr,
					db: formState.db,
					pool_size: formState.pool_size,
					use_tls: formState.use_tls,
				},
			}).unwrap();
			// Update server state so hasChanges resets
			setServerState({ enabled, formState: { ...formState } });
			toast.success("Vector store configuration saved.");
		} catch (error) {
			toast.error(`Failed to save: ${getErrorMessage(error)}`);
		}
	};

	const isVectorStoreEnabled = bifrostConfig?.is_cache_connected ?? false;
	const isLoading = configLoading || vsLoading;

	return (
		<div className="mx-auto w-full max-w-4xl space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Caching</h2>
				<p className="text-muted-foreground text-sm">Configure semantic caching for requests.</p>
			</div>

			{isLoading && (
				<div className="flex items-center justify-center py-8">
					<p className="text-muted-foreground">Loading configuration...</p>
				</div>
			)}

			{configError !== undefined && (
				<div className="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
					<p className="text-destructive text-sm font-medium">Failed to load configuration</p>
					<p className="text-muted-foreground mt-1 text-sm">
						{getErrorMessage(configError) || "An unexpected error occurred. Please try again."}
					</p>
				</div>
			)}

			{!isLoading && !configError && (
				<>
					{/* Vector Store Configuration Card */}
					<div className="rounded-lg border p-4 space-y-4">
						<div className="flex items-center justify-between space-x-2">
							<div className="flex-1 space-y-0.5">
								<Label className="text-sm font-medium flex items-center gap-2">
									<Plug className="h-4 w-4" />
									Vector Store
									{isVectorStoreEnabled && (
										<span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
											Connected
										</span>
									)}
								</Label>
								<p className="text-muted-foreground text-sm">
									{isVectorStoreEnabled
										? "Vector store is connected and operational."
										: "Configure a Redis/Valkey instance to enable vector storage for semantic caching."}
								</p>
							</div>
							<Switch size="md" checked={enabled} onCheckedChange={setEnabled} disabled={!hasSettingsUpdateAccess} />
						</div>

						{enabled && (
							<>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="vs-addr">
											<span className="flex items-center gap-1">
												<Server className="h-3 w-3" />
												Address*
											</span>
										</Label>
										<EnvVarInput
											id="vs-addr"
											placeholder="redis:6379"
											value={formState.addr}
											onChange={(val) => setFormState((s) => ({ ...s, addr: val }))}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="vs-db">Database</Label>
										<EnvVarInput
											id="vs-db"
											placeholder="0"
											value={formState.db}
											onChange={(val) => setFormState((s) => ({ ...s, db: val }))}
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="vs-pool">Pool Size</Label>
										<Input
											id="vs-pool"
											type="number"
											min={1}
											value={formState.pool_size}
											onChange={(e) => setFormState((s) => ({ ...s, pool_size: parseInt(e.target.value) || 10 }))}
										/>
									</div>
									<div className="flex items-center justify-between rounded-lg border p-3">
										<Label htmlFor="vs-tls">Use TLS</Label>
										<Switch
											id="vs-tls"
											size="md"
											checked={formState.use_tls.value === "true" || formState.use_tls.value === "1"}
											onCheckedChange={(checked) =>
												setFormState((s) => ({
													...s,
													use_tls: { value: checked ? "true" : "false", env_var: "", from_env: false },
												}))
											}
										/>
									</div>
								</div>
								<div className="flex items-center justify-between">
									{hasChanges && <RestartWarning />}
									<div className="ml-auto">
										<Button onClick={handleSave} disabled={!hasChanges || isUpdating || !hasSettingsUpdateAccess} size="sm">
											{isUpdating ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Saving...
												</>
											) : (
												"Save Vector Store Config"
											)}
										</Button>
									</div>
								</div>
							</>
						)}
					</div>

					{/* Semantic Cache Card */}
					<PluginsForm isVectorStoreEnabled={isVectorStoreEnabled} />
				</>
			)}
		</div>
	);
}

const RestartWarning = () => {
	return <div className="text-muted-foreground text-xs font-semibold">Need to restart Bifrost to apply changes.</div>;
};
