import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService } from "../services/profile";
import { fileService } from "../services/profile/FileService";
import {
	calculateCompletionPercentage,
	calculateCompletenessIndicatorLevel,
} from "../utils/profile";
import {
	type Profile,
	type WalletDocument,
	ProcessingStatusEnum,
} from "../schemas/profile.schema";

/**
 * useProfile is the primary hook for accessing and updating profile data.
 */
export interface UseProfileOptions {
	refetchOnMount?: boolean | "always";
	enabled?: boolean;
}

export const useProfile = (options?: UseProfileOptions) => {
	const queryClient = useQueryClient();

	const {
		data: queryData,
		isLoading,
		isError,
		refetch,
	} = useQuery<{ profile: Profile | null; files: WalletDocument[] }, Error>({
		queryKey: ["profile"],
		queryFn: async () => {
			const [profile, files] = await Promise.all([
				profileService.getProfile(),
				fileService.getFiles(),
			]);
			return { profile, files };
		},
		refetchOnMount: options?.refetchOnMount,
		enabled: options?.enabled,
		refetchInterval: (query) => {
			const activeData = query.state.data as
				{ profile: Profile | null; files: WalletDocument[] } | undefined;
			if (!activeData) {
				return false;
			}
			const hasProcessing = activeData.files?.some(
				(f) =>
					f.status === ProcessingStatusEnum.enum.PROCESSING ||
					f.status === ProcessingStatusEnum.enum.PENDING,
			);
			return hasProcessing ? 8000 : false;
		},
	});

	const documents = useMemo(() => {
		return queryData?.files ?? [];
	}, [queryData]);

	const selectedProfile = useMemo(() => {
		return queryData?.profile ?? null;
	}, [queryData]);

	const milestoneLevel = useMemo(() => {
		return calculateCompletenessIndicatorLevel(
			selectedProfile || {},
			documents,
		);
	}, [selectedProfile, documents]);

	const updateMutation = useMutation({
		mutationFn: ({
			section,
			data,
		}: {
			section: keyof Profile;
			data: Partial<Profile[keyof Profile]> & { validateEntireForm?: boolean };
		}) => profileService.updateProfileSection(section, data),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["profile"] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (documentId: string) => fileService.deleteFile(documentId),
		onMutate: async (documentId) => {
			await queryClient.cancelQueries({ queryKey: ["profile"] });
			const previousData = queryClient.getQueryData<{
				profile: Profile | null;
				files: WalletDocument[];
			}>(["profile"]);

			if (previousData) {
				queryClient.setQueryData(["profile"], {
					...previousData,
					files: previousData.files.filter((d) => d.id !== documentId),
				});
			}

			return { previousData };
		},
		onError: (_err, _documentId, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(["profile"], context.previousData);
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["profile"] });
		},
	});

	const submitMutation = useMutation({
		mutationFn: (data: Record<string, unknown>) =>
			profileService.submitProfile(data),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["profile"] });
		},
	});

	return {
		profileData: selectedProfile,
		documents,
		milestoneLevel,
		isLoading,
		isError,
		refetch,
		updateSection: updateMutation.mutateAsync,
		isUpdating: updateMutation.isPending || submitMutation.isPending,
		updateError: updateMutation.error || submitMutation.error,
		deleteDocument: deleteMutation.mutateAsync,
		isDeleting: deleteMutation.isPending,
		submitProfile: submitMutation.mutateAsync,
		completionPercentage: calculateCompletionPercentage(selectedProfile || {}),
	};
};
