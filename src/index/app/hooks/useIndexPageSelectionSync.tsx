import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { STORAGE_KEY_ACTIVE_TAB } from '../../constants';
import type { DataType, ItemData, SidebarTreeNode, TabType, ViewMode } from '../../types';
import type { ResourceSection, SelectedResourceFolder, SidebarTab, ThemeResourceItem } from '../../types/index-page.types';
import { isBrowsingResourceSidebarInPrototypeCanvas } from '../index-page/contentMode';
import {
    resolveIndexDeepLinkSelection,
    resolveResourceDeepLinkSelection,
    type ResourceDeepLinkTarget,
} from '../index-page/resourceDeepLink';

export interface PendingReturnTarget {
    sidebarTab: SidebarTab;
    resourceId: string | null;
    pageId: string | null;
    viewMode: ViewMode;
}

type PrototypeAutoSelectionDecision =
    | {
        kind: 'clear';
        markExplicitSelection: false;
        nextCanvasItem: null;
    }
    | {
        kind: 'keep';
        markExplicitSelection: boolean;
        nextCanvasItem: ItemData | null;
    }
    | {
        kind: 'select';
        item: ItemData;
        markExplicitSelection: boolean;
        resetPageSelection: boolean;
        nextCanvasItem: ItemData | null;
    };

interface ResolvePrototypeAutoSelectionDecisionParams {
    activeTab: TabType;
    hasExplicitSelection: boolean;
    items: ItemData[];
    lastCanvasItem: ItemData | null;
    selectedItem: ItemData | null;
    sidebarTab: SidebarTab;
    sidebarTrees: Record<'prototypes' | 'docs' | 'canvas', SidebarTreeNode[]>;
    viewMode: ViewMode;
}

function findFirstItemFromTree(
    nodes: SidebarTreeNode[],
    itemMap: Map<string, ItemData>,
): ItemData | null {
    for (const node of nodes) {
        if (node.kind === 'item' && node.itemKey) {
            const item = itemMap.get(node.itemKey);
            if (item) {
                return item;
            }
        }

        if (node.kind === 'folder' && Array.isArray(node.children)) {
            const childMatch = findFirstItemFromTree(node.children, itemMap);
            if (childMatch) {
                return childMatch;
            }
        }
    }

    return null;
}

export function resolvePrototypeAutoSelectionDecision({
    activeTab,
    hasExplicitSelection,
    items,
    lastCanvasItem,
    selectedItem,
    sidebarTab,
    sidebarTrees,
    viewMode,
}: ResolvePrototypeAutoSelectionDecisionParams): PrototypeAutoSelectionDecision {
    if (items.length === 0) {
        return {
            kind: 'clear',
            markExplicitSelection: false,
            nextCanvasItem: null,
        };
    }

    const itemMap = new Map(items.map((item) => [`prototypes/${item.name}`, item]));
    const currentItem = selectedItem ? itemMap.get(`prototypes/${selectedItem.name}`) ?? null : null;
    const currentCanvasItem = currentItem
        ?? (lastCanvasItem ? itemMap.get(`prototypes/${lastCanvasItem.name}`) ?? null : null);

    if (isBrowsingResourceSidebarInPrototypeCanvas({ sidebarTab, viewMode }) && currentCanvasItem) {
        const nextCanvasItem = currentCanvasItem;
        if (currentItem && selectedItem && currentItem !== selectedItem) {
            return {
                kind: 'select',
                item: currentItem,
                markExplicitSelection: true,
                resetPageSelection: false,
                nextCanvasItem,
            };
        }
        return currentItem
            ? {
                kind: 'keep',
                markExplicitSelection: true,
                nextCanvasItem,
            }
            : {
                kind: 'select',
                item: nextCanvasItem,
                markExplicitSelection: true,
                resetPageSelection: false,
                nextCanvasItem,
            };
    }

    const nextCanvasItem = viewMode === 'canvas' && currentItem ? currentItem : lastCanvasItem;
    if (hasExplicitSelection && currentItem) {
        if (selectedItem && currentItem !== selectedItem) {
            return {
                kind: 'select',
                item: currentItem,
                markExplicitSelection: true,
                resetPageSelection: false,
                nextCanvasItem,
            };
        }
        return {
            kind: 'keep',
            markExplicitSelection: true,
            nextCanvasItem,
        };
    }

    if (currentItem && selectedItem && currentItem.name === selectedItem.name) {
        if (currentItem === selectedItem) {
            return {
                kind: 'keep',
                markExplicitSelection: false,
                nextCanvasItem,
            };
        }
        return {
            kind: 'select',
            item: currentItem,
            markExplicitSelection: false,
            resetPageSelection: false,
            nextCanvasItem,
        };
    }

    const firstTreeItem = findFirstItemFromTree(sidebarTrees[activeTab], itemMap);
    const fallbackItem = items[0] ?? null;
    const autoSelectedItem = firstTreeItem ?? fallbackItem;
    if (!autoSelectedItem) {
        return {
            kind: 'keep',
            markExplicitSelection: false,
            nextCanvasItem,
        };
    }

    if (currentItem?.name === autoSelectedItem.name) {
        return {
            kind: 'keep',
            markExplicitSelection: hasExplicitSelection,
            nextCanvasItem,
        };
    }

    return {
        kind: 'select',
        item: autoSelectedItem,
        markExplicitSelection: false,
        resetPageSelection: currentItem?.name !== autoSelectedItem.name,
        nextCanvasItem,
    };
}

interface UseIndexPageSelectionSyncParams {
    loading: boolean;
    data: DataType;
    docsItems: ItemData[];
    themes: ThemeResourceItem[];
    sidebarAssetsLoaded: boolean;
    searchText: string;
    setSearchText: (value: string) => void;
    activeTab: TabType;
    setActiveTab: Dispatch<SetStateAction<TabType>>;
    selectedItem: ItemData | null;
    setSelectedItem: Dispatch<SetStateAction<ItemData | null>>;
    setSelectedPrototypePageId: Dispatch<SetStateAction<string | null>>;
    setSelectedDoc: Dispatch<SetStateAction<ItemData | null>>;
    setSelectedResourceFolder?: Dispatch<SetStateAction<SelectedResourceFolder | null>>;
    setSelectedTheme: Dispatch<SetStateAction<ThemeResourceItem | null>>;
    sidebarTrees: Record<'prototypes' | 'docs' | 'canvas', SidebarTreeNode[]>;
    sidebarTab: SidebarTab;
    setSidebarTab: Dispatch<SetStateAction<SidebarTab>>;
    resourceSection: ResourceSection;
    setResourceSection: Dispatch<SetStateAction<ResourceSection>>;
    viewMode: ViewMode;
    setViewMode: Dispatch<SetStateAction<ViewMode>>;
    pendingReturnTarget: PendingReturnTarget | null;
    setPendingReturnTarget: Dispatch<SetStateAction<PendingReturnTarget | null>>;
    initialResourceDeepLink?: ResourceDeepLinkTarget | null;
    onInitialResourceDeepLinkHandled?: () => void;
    setCollapsed?: (collapsed: boolean) => void;
    editorMode: 'none' | 'quickEdit';
    onExitWebEditor: (options: { restoreDevice: boolean }) => Promise<void>;
}

export function useIndexPageSelectionSync({
    loading,
    data,
    docsItems,
    themes,
    sidebarAssetsLoaded,
    searchText,
    setSearchText,
    activeTab,
    setActiveTab,
    selectedItem,
    setSelectedItem,
    setSelectedPrototypePageId,
    setSelectedDoc,
    setSelectedResourceFolder,
    setSelectedTheme,
    sidebarTrees,
    sidebarTab,
    setSidebarTab,
    resourceSection,
    setResourceSection,
    viewMode,
    setViewMode,
    pendingReturnTarget,
    setPendingReturnTarget,
    initialResourceDeepLink = null,
    onInitialResourceDeepLinkHandled,
    setCollapsed,
    editorMode,
    onExitWebEditor,
}: UseIndexPageSelectionSyncParams) {
    const hasExplicitSelectionRef = useRef(false);
    const lastPrototypeCanvasItemRef = useRef<ItemData | null>(null);
    const resourceDeepLinkConsumedRef = useRef(false);

    const markInitialResourceDeepLinkHandled = useCallback(() => {
        resourceDeepLinkConsumedRef.current = true;
        onInitialResourceDeepLinkHandled?.();
    }, [onInitialResourceDeepLinkHandled]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (loading || !data) {
            return;
        }

        const items = data.prototypes;
        if (!resourceDeepLinkConsumedRef.current && initialResourceDeepLink?.resourceType === 'prototype') {
            const resolvedDeepLink = resolveResourceDeepLinkSelection(initialResourceDeepLink, {
                prototypes: items,
                docs: docsItems,
            });
            if (resolvedDeepLink?.kind === 'prototype') {
                markInitialResourceDeepLinkHandled();
                setSidebarTab(resolvedDeepLink.sidebarTab);
                setViewMode(resolvedDeepLink.viewMode);
                setSelectedItem(resolvedDeepLink.item);
                setSelectedPrototypePageId(resolvedDeepLink.viewMode === 'demo' ? initialResourceDeepLink.pageId || null : null);
                lastPrototypeCanvasItemRef.current = resolvedDeepLink.viewMode === 'canvas'
                    ? resolvedDeepLink.item
                    : lastPrototypeCanvasItemRef.current;
                hasExplicitSelectionRef.current = true;
                if (resolvedDeepLink.collapseSidebar) {
                    setCollapsed?.(true);
                }
                return;
            }
            markInitialResourceDeepLinkHandled();
        }

        const decision = resolvePrototypeAutoSelectionDecision({
            activeTab,
            hasExplicitSelection: hasExplicitSelectionRef.current,
            items,
            lastCanvasItem: lastPrototypeCanvasItemRef.current,
            selectedItem,
            sidebarTab,
            sidebarTrees,
            viewMode,
        });
        lastPrototypeCanvasItemRef.current = decision.nextCanvasItem;

        if (decision.kind === 'clear') {
            hasExplicitSelectionRef.current = false;
            if (selectedItem !== null) {
                setSelectedItem(null);
            }
            setSelectedPrototypePageId(null);
            return;
        }

        const itemMap = new Map(items.map((item) => [`prototypes/${item.name}`, item]));
        const pendingTargetItem = pendingReturnTarget?.sidebarTab === 'prototype' && pendingReturnTarget.resourceId
            ? itemMap.get(`prototypes/${pendingReturnTarget.resourceId}`) ?? null
            : null;
        const currentItem = selectedItem ? itemMap.get(`prototypes/${selectedItem.name}`) ?? null : null;

        if (pendingReturnTarget?.sidebarTab === 'prototype') {
            setSidebarTab('prototype');
            setViewMode(pendingReturnTarget.viewMode);
            setSelectedPrototypePageId(pendingReturnTarget.pageId || null);
            if (pendingTargetItem) {
                if (currentItem?.name !== pendingTargetItem.name) {
                    setSelectedItem(pendingTargetItem);
                }
                lastPrototypeCanvasItemRef.current = pendingReturnTarget.viewMode === 'canvas'
                    ? pendingTargetItem
                    : lastPrototypeCanvasItemRef.current;
                hasExplicitSelectionRef.current = true;
                setPendingReturnTarget(null);
                return;
            }
        }

        if (decision.markExplicitSelection) {
            hasExplicitSelectionRef.current = true;
        }
        if (decision.kind === 'keep') {
            return;
        }

        setSelectedItem(decision.item);
        if (decision.resetPageSelection) {
            setSelectedPrototypePageId(null);
        }
        if (pendingReturnTarget?.sidebarTab === 'prototype') {
            setPendingReturnTarget(null);
        }
    }, [
        activeTab,
        data,
        docsItems,
        initialResourceDeepLink,
        loading,
        markInitialResourceDeepLinkHandled,
        onInitialResourceDeepLinkHandled,
        pendingReturnTarget,
        selectedItem,
        setCollapsed,
        setPendingReturnTarget,
        setSelectedItem,
        setSelectedPrototypePageId,
        setSidebarTab,
        setViewMode,
        sidebarTab,
        sidebarTrees,
        viewMode,
    ]);

    useEffect(() => {
        if (loading) {
            return;
        }
        if ((initialResourceDeepLink?.resourceType === 'doc' || initialResourceDeepLink?.resourceType === 'theme') && !sidebarAssetsLoaded) {
            return;
        }
        if (!resourceDeepLinkConsumedRef.current && initialResourceDeepLink?.resourceType === 'doc') {
            const resolvedDeepLink = resolveIndexDeepLinkSelection(initialResourceDeepLink, {
                prototypes: data.prototypes,
                docs: docsItems,
                themes,
            });
            if (resolvedDeepLink?.kind === 'doc') {
                markInitialResourceDeepLinkHandled();
                setSidebarTab(resolvedDeepLink.sidebarTab);
                setSelectedResourceFolder?.(null);
                setSelectedDoc(resolvedDeepLink.item);
                if (resolvedDeepLink.collapseSidebar) {
                    setCollapsed?.(true);
                }
                return;
            }
            markInitialResourceDeepLinkHandled();
        }
        if (!resourceDeepLinkConsumedRef.current && initialResourceDeepLink?.resourceType === 'theme') {
            const resolvedDeepLink = resolveIndexDeepLinkSelection(initialResourceDeepLink, {
                prototypes: data.prototypes,
                docs: docsItems,
                themes,
            });
            if (resolvedDeepLink?.kind === 'theme') {
                markInitialResourceDeepLinkHandled();
                setSidebarTab(resolvedDeepLink.sidebarTab);
                setResourceSection(resolvedDeepLink.resourceSection);
                setSelectedTheme(resolvedDeepLink.theme);
                setViewMode('demo');
                if (resolvedDeepLink.collapseSidebar) {
                    setCollapsed?.(true);
                }
                return;
            }
            markInitialResourceDeepLinkHandled();
        }
        if (pendingReturnTarget?.sidebarTab === 'document') {
            const pendingDocItem = pendingReturnTarget.resourceId
                ? docsItems.find((item) => item.name === pendingReturnTarget.resourceId) ?? null
                : null;
            const fallbackDocItem = docsItems[0] ?? null;

            const nextDocItem = pendingDocItem ?? fallbackDocItem;
            if (nextDocItem) {
                setSidebarTab('document');
                setSelectedResourceFolder?.(null);
                setSelectedDoc(nextDocItem);
                setPendingReturnTarget(null);
            }
        }
    }, [
        data.prototypes,
        docsItems,
        initialResourceDeepLink,
        loading,
        markInitialResourceDeepLinkHandled,
        onInitialResourceDeepLinkHandled,
        pendingReturnTarget,
        sidebarAssetsLoaded,
        setCollapsed,
        setPendingReturnTarget,
        setSelectedDoc,
        setSelectedResourceFolder,
        setSelectedTheme,
        setResourceSection,
        setSidebarTab,
        setViewMode,
        themes,
    ]);

    useEffect(() => {
        if (sidebarTab === 'prototype' && activeTab !== 'prototypes') {
            if (viewMode !== 'canvas') {
                hasExplicitSelectionRef.current = false;
            }
            setActiveTab('prototypes');
        }
    }, [activeTab, sidebarTab, viewMode]);

    const filteredItems = useMemo(() => {
        const items = data.prototypes;
        if (!searchText) {
            return items;
        }

        const lowerSearch = searchText.toLowerCase();
        return items.filter((item) => (
            item.displayName.toLowerCase().includes(lowerSearch)
            || item.name.toLowerCase().includes(lowerSearch)
        ));
    }, [data.prototypes, searchText]);

    const handleMenuClick = useCallback(async ({ key, pageId }: { key: string; pageId?: string | null }) => {
        if (editorMode === 'quickEdit') {
            await onExitWebEditor({ restoreDevice: false });
        }

        const item = filteredItems.find((candidate) => candidate.name === key);
        if (!item) {
            return;
        }

        hasExplicitSelectionRef.current = true;
        setSelectedItem(item);
        setSelectedPrototypePageId(pageId || null);
    }, [editorMode, filteredItems, onExitWebEditor, setSelectedPrototypePageId]);

    const handleTabChange = useCallback((tab: TabType) => {
        if (tab === activeTab) {
            return;
        }

        if (editorMode === 'quickEdit') {
            void onExitWebEditor({ restoreDevice: false });
        }

        // When in canvas viewMode or browsing from the file-canvas sidebar tab,
        // keep the explicit selection so auto-selection doesn't override the
        // currently viewed prototype.
        if (viewMode !== 'canvas' && sidebarTab !== 'canvas') {
            hasExplicitSelectionRef.current = false;
        }
        setActiveTab(tab);
        setSearchText('');
    }, [activeTab, editorMode, onExitWebEditor, setSearchText, sidebarTab, viewMode]);

    return {
        activeTab,
        setActiveTab,
        selectedItem,
        setSelectedItem,
        sidebarTab,
        setSidebarTab,
        resourceSection,
        setResourceSection,
        filteredItems,
        handleMenuClick,
        handleTabChange,
    };
}
