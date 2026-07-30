import { useCallback, useEffect, useState } from 'react';
import {
    createSpecVersion,
    listSpecVersions
} from '../services/specVersionService';

export function useSpecVersions(sessionToken) {
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [isLoading, setIsLoading] = useState(Boolean(sessionToken));
    const [error, setError] = useState(null);

    const refreshVersions = useCallback(async () => {
        if (!sessionToken) {
            setVersions([]);
            setSelectedVersion(null);
            setIsLoading(false);
            return [];
        }

        setIsLoading(true);
        const result = await listSpecVersions(sessionToken);
        setIsLoading(false);
        setError(result.error);
        if (result.error) {
            return [];
        }

        setVersions(result.versions);
        setSelectedVersion(result.versions[0] || null);
        return result.versions;
    }, [sessionToken]);

    useEffect(() => {
        let active = true;
        if (!sessionToken) {
            setVersions([]);
            setSelectedVersion(null);
            setIsLoading(false);
            return undefined;
        }

        setIsLoading(true);
        listSpecVersions(sessionToken).then(result => {
            if (!active) return;
            setIsLoading(false);
            setError(result.error);
            if (!result.error) {
                setVersions(result.versions);
                setSelectedVersion(result.versions[0] || null);
            }
        });

        return () => {
            active = false;
        };
    }, [sessionToken]);

    const selectVersion = useCallback(versionId => {
        setSelectedVersion(current => (
            versions.find(version => version.id === versionId) || current
        ));
    }, [versions]);

    const createVersion = useCallback(async ({ content, sourceMessageCount }) => {
        const requestId = crypto.randomUUID();
        const result = await createSpecVersion(sessionToken, {
            requestId,
            content,
            sourceMessageCount
        });
        setError(result.error);
        if (!result.version) {
            return result;
        }

        setVersions(current => [
            result.version,
            ...current.filter(version => version.id !== result.version.id)
        ].slice(0, 6));
        setSelectedVersion(result.version);
        return result;
    }, [sessionToken]);

    return {
        versions,
        selectedVersion,
        selectVersion,
        createVersion,
        refreshVersions,
        isLoading,
        error
    };
}
