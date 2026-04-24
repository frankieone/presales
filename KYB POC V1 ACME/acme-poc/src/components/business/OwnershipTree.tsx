'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  type EdgeTypes,
  type EdgeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { AustralianOwnershipResponse, BlockingEntity, OwnershipShareholder, TrustAnalysisResult } from '@/types/business';
import type { Individual } from '@/types/individual';
import { AddEntityModal } from './AddEntityModal';
import { EntityDetailModal } from './EntityDetailModal';

// ─── Types ──────────────────────────────────────────────────────────

interface OwnershipTreeProps {
  ownership: AustralianOwnershipResponse;
  blockingEntities: BlockingEntity[];
  onAddNode?: () => void;
  onEditNode?: (nodeId: string, data: OwnershipNodeData) => void;
  onRemoveNode?: (nodeId: string) => void;
  onEntityAdded?: (parentEntityId: string, newEntity: { entityId: string; entityType: 'INDIVIDUAL' | 'ORGANIZATION'; name: string; role: string }) => void;
  trustAnalysisResults?: Record<string, TrustAnalysisResult>;
  trustLinkedOrgId?: string | null;
  onTrustLinkOrg?: (orgId: string) => void;
  individuals?: Individual[];
  kycResults?: Map<string, { overallResult?: string; status?: string }>;
}

interface OwnershipNodeData {
  label: string;
  nodeType: 'company' | 'individual' | 'organisation' | 'trust' | 'trustIndividual';
  role?: string;
  percentage?: number;
  isBeneficial?: boolean;
  isBlocking?: boolean;
  isAboveThreshold?: boolean;
  isJointHolder?: boolean;
  blockingReasons?: string[];
  trustRole?: string;
  isLinkedIndividual?: boolean;
  verificationStatus?: string; // 'pass' | 'fail' | 'review' | 'pending' | undefined
  onEdit?: (id: string, data: OwnershipNodeData) => void;
  onRemove?: (id: string) => void;
  onAdd?: (id: string, label: string) => void;
  onNodeClick?: (id: string, data: OwnershipNodeData) => void;
  onLinkTrust?: (orgId: string) => void;
  [key: string]: unknown;
}

// ─── Layout ─────────────────────────────────────────────────────────

const NODE_WIDTH = 140;

const NODE_HEIGHTS: Record<string, number> = {
  company: 88,
  individual: 88,
  organisation: 88,
  addPlaceholder: 88,
  jointGroup: 88,
  trust: 88,
  trustIndividual: 80,
};

function layoutGraph(nodes: Node<OwnershipNodeData>[], edges: Edge[]): Node<OwnershipNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 140, nodesep: 30, marginx: 10, marginy: 5 });

  nodes.forEach((node) => {
    const w = node.style?.width ? Number(node.style.width) : NODE_WIDTH;
    const h = node.style?.height ? Number(node.style.height) : (NODE_HEIGHTS[node.type || 'individual'] || 80);
    g.setNode(node.id, { width: w, height: h });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const w = node.style?.width ? Number(node.style.width) : NODE_WIDTH;
    const h = node.style?.height ? Number(node.style.height) : (NODE_HEIGHTS[node.type || 'individual'] || 80);
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });
}

// ─── Custom Edge ─────────────────────────────────────────────────────

function OffsetSmoothStepEdge({
  id, sourceX, sourceY, targetX, targetY,
  style, markerEnd, label, labelStyle, labelBgStyle,
  data,
}: EdgeProps) {
  const dropDistance = (data as any)?.offset ?? 40;
  const sourceXShift = (data as any)?.sourceXOffset ?? 0;
  const R = 8;

  const adjustedSourceX = sourceX + sourceXShift;
  const bendY = sourceY + dropDistance;

  const dx = targetX - adjustedSourceX;
  const dirX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const absDx = Math.abs(dx);

  let edgePath: string;
  if (absDx < 1) {
    edgePath = `M ${adjustedSourceX} ${sourceY} L ${adjustedSourceX} ${targetY}`;
  } else {
    const r = Math.min(R, absDx / 2, dropDistance / 2);
    edgePath = [
      `M ${adjustedSourceX} ${sourceY}`,
      `L ${adjustedSourceX} ${bendY - r}`,
      `Q ${adjustedSourceX} ${bendY} ${adjustedSourceX + dirX * r} ${bendY}`,
      `L ${targetX - dirX * r} ${bendY}`,
      `Q ${targetX} ${bendY} ${targetX} ${bendY + r}`,
      `L ${targetX} ${targetY}`,
    ].join(' ');
  }

  const labelX = (adjustedSourceX + targetX) / 2;
  const labelY = bendY;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              ...(labelBgStyle ? {
                background: (labelBgStyle as any).fill || '#fff',
                opacity: (labelBgStyle as any).fillOpacity ?? 1,
              } : {}),
              padding: '0px 4px',
              borderRadius: 3,
              lineHeight: '16px',
              fontSize: 11,
            }}
            className="nodrag nopan"
          >
            <span style={labelStyle as React.CSSProperties}>{label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = {
  offsetSmooth: OffsetSmoothStepEdge,
};

// ─── Custom Nodes ───────────────────────────────────────────────────

function JointGroupNode({ data }: NodeProps<Node<OwnershipNodeData>>) {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 w-full h-full relative"
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-2 !h-2" />
      <div className="absolute -top-2.5 left-2 px-1 bg-white flex items-center gap-1">
        <img src="/group.png" alt="" className="w-3 h-3" />
        <span className="text-[9px] font-medium text-amber-600">Joint Holders</span>
      </div>
    </div>
  );
}

function AddPlaceholderNode({ id, data }: NodeProps<Node<OwnershipNodeData>>) {
  const parentEntityId = id.replace('add-placeholder-', '');
  return (
    <div
      className="rounded-xl border-2 border-dashed border-wise-gray-300 bg-wise-gray-50/50 px-2 py-2 w-[140px] h-[88px] cursor-pointer hover:border-wise-navy hover:bg-wise-navy/5 transition-colors group flex items-center justify-center"
      onClick={() => data.onAdd?.(parentEntityId, data.label)}
    >
      <Handle type="target" position={Position.Top} className="!bg-wise-gray-300 !w-2 !h-2" />
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-wise-gray-300 text-wise-gray-400 group-hover:border-wise-navy group-hover:text-wise-navy transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <span className="text-[10px] font-medium text-wise-gray-400 group-hover:text-wise-navy transition-colors">
          Add Entity
        </span>
      </div>
    </div>
  );
}

function CompanyNode({ id, data }: NodeProps<Node<OwnershipNodeData>>) {
  return (
    <div className="rounded-xl border-2 border-wise-navy/30 bg-wise-navy/5 px-2 py-2 shadow-sm w-[140px] h-[88px] flex items-center justify-center">
      <Handle type="target" position={Position.Top} className="!bg-wise-navy !w-2 !h-2" />
      <div className="flex flex-col items-center gap-1 text-center">
        <img src="/office-building.png" alt="" className="w-7 h-7" />
        <div className="min-w-0 w-full">
          <div className="font-bold text-[11px] text-wise-navy leading-tight line-clamp-2">{data.label}</div>
          {data.role && <div className="text-[9px] text-wise-gray-500 truncate mt-0.5">{data.role}</div>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-wise-navy !w-2 !h-2" />
    </div>
  );
}

function IndividualNode({ id, data }: NodeProps<Node<OwnershipNodeData>>) {
  const [hovering, setHovering] = useState(false);
  const isAboveThreshold = data.isAboveThreshold !== false;
  const isBeneficial = data.isBeneficial !== false;
  const isJointHolder = data.isJointHolder;
  const isLinked = data.isLinkedIndividual;
  const vStatus = data.verificationStatus;

  const statusBadge: Record<string, { label: string; className: string }> = {
    pass: { label: 'Pass', className: 'bg-green-100 text-green-700' },
    fail: { label: 'Failed', className: 'bg-red-100 text-red-700' },
    review: { label: 'Review', className: 'bg-amber-100 text-amber-700' },
    pending: { label: 'Not Checked', className: 'bg-gray-100 text-gray-500' },
  };
  const badge = isLinked && vStatus ? statusBadge[vStatus] : null;

  const badgeBg = isAboveThreshold
    ? (isBeneficial ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')
    : 'bg-gray-100 text-gray-500';

  return (
    <div
      className={`rounded-xl border-2 px-2 py-2 shadow-sm w-[140px] h-[80px] relative cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center ${
        isLinked
          ? 'border-green-400 bg-green-50/60 ring-1 ring-green-300'
          : isJointHolder
          ? 'border-amber-300 bg-white ring-1 ring-amber-200'
          : 'border-wise-gray-200 bg-white'
      }`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => data.onNodeClick?.(id, data)}
    >
      <Handle type="target" position={Position.Top} className={`!w-2 !h-2 ${isLinked ? '!bg-green-500' : '!bg-gray-400'}`} />
      {badge ? (
        <span className={`absolute -top-2 -right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white ${badge.className}`}>
          {badge.label}
        </span>
      ) : data.percentage != null ? (
        <span className={`absolute -top-2 -right-2 min-w-[28px] h-[18px] flex items-center justify-center text-[9px] font-bold rounded-full shadow-sm border border-white ${badgeBg}`}>
          {data.percentage}%
        </span>
      ) : null}
      <div className="flex flex-col items-center gap-1 text-center">
        <img src="/user.png" alt="" className="w-7 h-7" />
        <div className="min-w-0 w-full">
          <div className={`font-semibold text-[10px] leading-tight line-clamp-2 ${isLinked ? 'text-green-800' : 'text-wise-navy'}`}>{data.label}</div>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {data.role && <span className={`text-[9px] ${isLinked ? 'text-green-600' : 'text-wise-gray-500'}`}>{data.role}</span>}
            {isJointHolder && (
              <span className="text-[9px] font-medium px-1 rounded-full bg-amber-50 text-amber-700">
                Joint
              </span>
            )}
          </div>
        </div>
      </div>
      {hovering && !isLinked && (data.onEdit || data.onRemove) && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          {data.onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onEdit!(id, data); }}
              className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shadow hover:bg-blue-600"
              title="Edit"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {data.onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onRemove!(id); }}
              className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600"
              title="Remove"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={`!w-2 !h-2 ${isLinked ? '!bg-green-500' : '!bg-gray-400'}`} />
    </div>
  );
}

function OrganisationNode({ id, data }: NodeProps<Node<OwnershipNodeData>>) {
  const [hovering, setHovering] = useState(false);
  const isBlocking = data.isBlocking;

  return (
    <div
      className={`rounded-xl border-2 px-2 py-2 shadow-sm w-[140px] h-[80px] relative cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center ${
        isBlocking ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-blue-50'
      }`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => data.onNodeClick?.(id, data)}
    >
      <Handle type="target" position={Position.Top} className={`!w-2 !h-2 ${isBlocking ? '!bg-red-500' : '!bg-blue-500'}`} />
      {data.percentage != null && (
        <span className={`absolute -top-2 -right-2 min-w-[28px] h-[18px] flex items-center justify-center text-[9px] font-bold rounded-full shadow-sm border border-white ${
          isBlocking ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {data.percentage}%
        </span>
      )}
      <div className="flex flex-col items-center gap-1 text-center">
        <img src="/office-building.png" alt="" className="w-7 h-7" />
        <div className="min-w-0 w-full">
          <div className="font-semibold text-[10px] text-wise-navy leading-tight line-clamp-2">{data.label}</div>
          {isBlocking && (
            <span className="text-[9px] font-medium text-red-600 block">Blocking</span>
          )}
          {data.role && !isBlocking && <div className="text-[9px] text-wise-gray-500">{data.role}</div>}
        </div>
      </div>
      {hovering && (data.onEdit || data.onRemove) && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          {data.onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onEdit!(id, data); }}
              className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shadow hover:bg-blue-600"
              title="Edit"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {data.onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onRemove!(id); }}
              className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600"
              title="Remove"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={`!w-2 !h-2 ${isBlocking ? '!bg-red-500' : '!bg-blue-500'}`} />
    </div>
  );
}

function TrustNode({ id, data }: NodeProps<Node<OwnershipNodeData>>) {
  return (
    <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 px-2 py-2 shadow-sm w-[140px] h-[88px] flex items-center justify-center">
      <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-2 !h-2" />
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="w-7 h-7 rounded-full bg-yellow-200 flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0 w-full">
          <div className="font-bold text-[10px] text-yellow-800 leading-tight line-clamp-2">{data.label}</div>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-200 text-yellow-700">Trust</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-500 !w-2 !h-2" />
    </div>
  );
}

function TrustIndividualNode({ id, data }: NodeProps<Node<OwnershipNodeData>>) {
  const isLinked = data.isLinkedIndividual;
  const status = data.verificationStatus;

  const statusBadge: Record<string, { label: string; className: string }> = {
    pass: { label: 'Pass', className: 'bg-green-100 text-green-700' },
    fail: { label: 'Failed', className: 'bg-red-100 text-red-700' },
    review: { label: 'Review', className: 'bg-amber-100 text-amber-700' },
    pending: { label: 'Not Checked', className: 'bg-gray-100 text-gray-500' },
  };

  const badge = status ? statusBadge[status] : null;

  return (
    <div
      className={`rounded-xl border-2 px-2 py-2 shadow-sm w-[140px] h-[80px] flex items-center justify-center relative ${
        isLinked
          ? 'border-green-400 bg-green-50/60 ring-1 ring-green-300'
          : 'border-yellow-300 bg-yellow-50/80'
      }`}
      onClick={() => data.onNodeClick?.(id, data)}
    >
      <Handle type="target" position={Position.Top} className={`!w-2 !h-2 ${isLinked ? '!bg-green-500' : '!bg-yellow-400'}`} />
      {badge && (
        <span className={`absolute -top-2 -right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white ${badge.className}`}>
          {badge.label}
        </span>
      )}
      <div className="flex flex-col items-center gap-1 text-center">
        <img src="/user.png" alt="" className="w-7 h-7" style={{ filter: isLinked ? undefined : 'sepia(100%) saturate(300%) brightness(90%) hue-rotate(10deg)' }} />
        <div className="min-w-0 w-full">
          <div className={`font-semibold text-[10px] leading-tight line-clamp-2 ${isLinked ? 'text-green-800' : 'text-yellow-800'}`}>{data.label}</div>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {data.trustRole && <span className={`text-[9px] font-medium px-1 rounded-full ${isLinked ? 'bg-green-100 text-green-700' : 'bg-yellow-200 text-yellow-700'}`}>{data.trustRole}</span>}
            <span className={`text-[9px] px-1 rounded-full ${isLinked ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>Trust</span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className={`!w-2 !h-2 ${isLinked ? '!bg-green-500' : '!bg-yellow-400'}`} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  company: CompanyNode,
  individual: IndividualNode,
  organisation: OrganisationNode,
  addPlaceholder: AddPlaceholderNode,
  jointGroup: JointGroupNode,
  trust: TrustNode,
  trustIndividual: TrustIndividualNode,
};

// ─── Build graph from ownership data ────────────────────────────────

const BENEFICIAL_THRESHOLD = 25;

function formatRole(role: string): string {
  const map: Record<string, string> = {
    DR: 'Director',
    SR: 'Secretary',
    AR: 'Alternate Director',
    UBO: 'UBO',
  };
  return map[role] || role;
}

function buildGraph(
  ownership: AustralianOwnershipResponse,
  blockingEntities: BlockingEntity[],
  callbacks: {
    onEdit?: (id: string, data: OwnershipNodeData) => void;
    onRemove?: (id: string) => void;
    onAdd?: (id: string, label: string) => void;
    onNodeClick?: (id: string, data: OwnershipNodeData) => void;
    onLinkTrust?: (orgId: string) => void;
  },
  trustData?: {
    trustAnalysisResults?: Record<string, TrustAnalysisResult>;
    trustLinkedOrgId?: string | null;
    individuals?: Individual[];
    kycResults?: Map<string, { overallResult?: string; status?: string }>;
  }
): { nodes: Node<OwnershipNodeData>[]; edges: Edge[]; rootId: string } {
  const nodes: Node<OwnershipNodeData>[] = [];
  const edges: Edge[] = [];
  const addedIds = new Set<string>();

  const rootId = ownership.entityId || 'root';

  // Root company node
  nodes.push({
    id: rootId,
    type: 'company',
    position: { x: 0, y: 0 },
    data: {
      label: ownership.businessDetails?.registeredName || 'Business',
      nodeType: 'company',
      role: [
        ownership.businessDetails?.asicCompanyType,
        ownership.businessDetails?.ABN ? `ABN: ${ownership.businessDetails.ABN}` : null,
      ].filter(Boolean).join(' | '),
    },
  });
  addedIds.add(rootId);

  // Blocking entity lookup
  const blockingMap = new Map<string, BlockingEntity>();
  for (const be of blockingEntities) {
    blockingMap.set(be.entityId, be);
  }

  // Build lookup for linked individuals (from store) by entity ID and name
  const linkedIndividualById = new Map<string, Individual>();
  const linkedIndividualByName = new Map<string, Individual>();
  for (const ind of (trustData?.individuals || [])) {
    linkedIndividualById.set(ind.id, ind);
    const shortKey = `${ind.givenName} ${ind.familyName}`.trim().toLowerCase();
    if (shortKey) linkedIndividualByName.set(shortKey, ind);
    if (ind.middleName) {
      const fullKey = `${ind.givenName} ${ind.middleName} ${ind.familyName}`.trim().toLowerCase();
      if (fullKey) linkedIndividualByName.set(fullKey, ind);
    }
  }

  function isLinkedToIndividualsList(entityId: string, name: string): boolean {
    if (linkedIndividualById.has(entityId)) return true;
    const nameLower = name.toLowerCase().trim();
    if (linkedIndividualByName.has(nameLower)) return true;
    return false;
  }

  function getIndividualVerificationStatus(entityId: string, name: string): string | undefined {
    const kycResults = trustData?.kycResults;
    if (!kycResults || kycResults.size === 0) return 'pending';
    // Try by entity ID first
    let ind = linkedIndividualById.get(entityId);
    if (!ind) {
      const nameLower = name.toLowerCase().trim();
      ind = linkedIndividualByName.get(nameLower);
    }
    if (!ind) return 'pending';
    const result = kycResults.get(ind.id);
    if (!result) return 'pending';
    const s = (result.overallResult || result.status || '').toLowerCase();
    if (s.includes('pass') || s.includes('clear')) return 'pass';
    if (s.includes('fail') || s.includes('reject') || s.includes('error')) return 'fail';
    if (s.includes('review') || s.includes('refer')) return 'review';
    return 'pending';
  }

  // Officeholder roles lookup
  const officeholderRoles: Record<string, string[]> = {};
  for (const o of ownership.officeholders || []) {
    if (o.entityId && o.role) {
      if (!officeholderRoles[o.entityId]) officeholderRoles[o.entityId] = [];
      if (!officeholderRoles[o.entityId].includes(formatRole(o.role))) {
        officeholderRoles[o.entityId].push(formatRole(o.role));
      }
    }
  }

  // UBO lookup
  const uboIds = new Set((ownership.ubos || []).map((u) => u.entityId).filter(Boolean));

  // Joint holder groups
  const jointGroups = new Map<string, string[]>();
  for (const sh of (ownership.shareholders || [])) {
    if (sh.jointHolderGroup) {
      if (!jointGroups.has(sh.jointHolderGroup)) jointGroups.set(sh.jointHolderGroup, []);
      jointGroups.get(sh.jointHolderGroup)!.push(sh.entityId);
    }
  }
  const jointHolderIds = new Set<string>();
  for (const members of jointGroups.values()) {
    if (members.length >= 2) {
      for (const id of members) jointHolderIds.add(id);
    }
  }

  const entityToJointGroup = new Map<string, string>();
  for (const sh of (ownership.shareholders || [])) {
    if (sh.jointHolderGroup) entityToJointGroup.set(sh.entityId, sh.jointHolderGroup);
  }
  const jointGroupEdgeAdded = new Set<string>();

  function addShareholderNode(sh: OwnershipShareholder, parentId: string) {
    if (addedIds.has(sh.entityId)) return;
    addedIds.add(sh.entityId);

    const isBeneficial = !sh.isBlocking;
    const pct = sh.percentOwned ?? 0;

    if (sh.entityType === 'ORGANIZATION') {
      const blocking = blockingMap.get(sh.entityId);
      const hasBeneficial = (sh.percentBeneficially ?? 0) > 0;
      const hasNonBeneficial = (sh.percentNonBeneficially ?? 0) > 0;
      const isBeneficialOwnership = hasBeneficial || (!hasNonBeneficial && !sh.isBlocking);

      nodes.push({
        id: sh.entityId,
        type: 'organisation',
        position: { x: 0, y: 0 },
        data: {
          label: sh.name || 'Unknown Organisation',
          nodeType: 'organisation',
          percentage: sh.percentOwned ?? sh.percentBeneficially ?? sh.percentNonBeneficially,
          isBlocking: sh.isBlocking,
          blockingReasons: blocking?.reasons?.map((r) => r.description).filter(Boolean),
          onEdit: callbacks.onEdit,
          onRemove: callbacks.onRemove,
          onNodeClick: callbacks.onNodeClick,
        },
      });

      const edgeColor = isBeneficialOwnership ? '#22c55e' : '#ef4444';
      let edgeLabel: string | undefined;
      if (sh.percentOwned != null) {
        edgeLabel = isBeneficialOwnership ? `${sh.percentOwned}% BH` : `${sh.percentOwned}% NBH`;
      }
      edges.push({
        id: `e-${parentId}-${sh.entityId}`,
        source: parentId,
        target: sh.entityId,
        type: 'offsetSmooth',
        animated: !!sh.isBlocking,
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        label: edgeLabel,
        labelStyle: { fontSize: 11, fontWeight: 600, fill: edgeColor },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      });

      if (sh.children && sh.children.length > 0) {
        for (const child of sh.children) {
          addShareholderNode(child, sh.entityId);
        }
      }
    } else {
      const roles: string[] = [];
      const extra = officeholderRoles[sh.entityId] || sh.roles?.map(formatRole) || [];
      if (extra.length > 0) roles.push(...extra);
      if (uboIds.has(sh.entityId)) roles.push('UBO');
      if (roles.length === 0) roles.push('Shareholder');

      const isAboveThreshold = pct >= BENEFICIAL_THRESHOLD;
      const isJoint = jointHolderIds.has(sh.entityId);

      const shName = sh.name || 'Unknown Individual';
      const shIsLinked = isLinkedToIndividualsList(sh.entityId, shName);

      nodes.push({
        id: sh.entityId,
        type: 'individual',
        position: { x: 0, y: 0 },
        data: {
          label: shName,
          nodeType: 'individual',
          role: [...new Set(roles)].join(', '),
          percentage: sh.percentOwned,
          isBeneficial,
          isAboveThreshold,
          isJointHolder: isJoint,
          isLinkedIndividual: shIsLinked,
          verificationStatus: shIsLinked ? getIndividualVerificationStatus(sh.entityId, shName) : undefined,
          onEdit: callbacks.onEdit,
          onRemove: callbacks.onRemove,
          onNodeClick: callbacks.onNodeClick,
        },
      });

      const jointGroup = entityToJointGroup.get(sh.entityId);
      if (isJoint && jointGroup) {
        if (!jointGroupEdgeAdded.has(jointGroup)) {
          jointGroupEdgeAdded.add(jointGroup);
          const groupMembers = jointGroups.get(jointGroup) || [];
          const groupShareholders = (ownership.shareholders || []).filter(s => groupMembers.includes(s.entityId));
          const totalPct = groupShareholders.reduce((sum, s) => sum + (s.percentOwned ?? 0), 0);
          const edgeColor = isBeneficial ? '#22c55e' : '#ef4444';
          const edgeLabel = totalPct > 0 ? `${totalPct}% BH (joint)` : undefined;

          edges.push({
            id: `e-${parentId}-jg-${jointGroup}`,
            source: parentId,
            target: `joint-group-${jointGroup}`,
            type: 'offsetSmooth',
            style: { stroke: edgeColor, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
            label: edgeLabel,
            labelStyle: { fontSize: 11, fontWeight: 600, fill: edgeColor },
            labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
            labelBgPadding: [4, 2] as [number, number],
          });
        }
      } else {
        const edgeColor = isBeneficial ? '#22c55e' : '#ef4444';
        let indEdgeLabel: string | undefined;
        if (sh.percentOwned != null) {
          indEdgeLabel = isBeneficial ? `${sh.percentOwned}% BH` : `${sh.percentOwned}% NBH`;
        }
        edges.push({
          id: `e-${parentId}-${sh.entityId}`,
          source: parentId,
          target: sh.entityId,
          type: 'offsetSmooth',
          style: { stroke: edgeColor, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
          label: indEdgeLabel,
          labelStyle: { fontSize: 11, fontWeight: 600, fill: edgeColor },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
        });
      }
    }
  }

  // Sort shareholders
  const shareholders: OwnershipShareholder[] = ownership.shareholders || [];
  const sortedShareholders = [...shareholders].sort((a, b) => {
    const aIsOrg = a.entityType === 'ORGANIZATION' ? 0 : 1;
    const bIsOrg = b.entityType === 'ORGANIZATION' ? 0 : 1;
    if (aIsOrg !== bIsOrg) return aIsOrg - bIsOrg;

    const aGroup = a.jointHolderGroup || '';
    const bGroup = b.jointHolderGroup || '';
    if (!aGroup && bGroup) return -1;
    if (aGroup && !bGroup) return 1;
    if (aGroup && bGroup && aGroup !== bGroup) return aGroup.localeCompare(bGroup);

    return 0;
  });

  for (const sh of sortedShareholders) {
    addShareholderNode(sh, rootId);
  }

  // UBOs not already in shareholders
  for (const ubo of ownership.ubos || []) {
    const id = ubo.entityId || ubo.name;
    if (addedIds.has(id)) continue;
    addedIds.add(id);

    const roles: string[] = [];
    const extra = ubo.entityId ? officeholderRoles[ubo.entityId] : undefined;
    if (extra && extra.length > 0) roles.push(...extra);
    roles.push('UBO');

    const pctVal = ubo.percentOwned ?? 0;
    const isAboveThreshold = pctVal >= BENEFICIAL_THRESHOLD;

    const uboIsLinked = isLinkedToIndividualsList(id, ubo.name);

    nodes.push({
      id,
      type: 'individual',
      position: { x: 0, y: 0 },
      data: {
        label: ubo.name,
        nodeType: 'individual',
        role: [...new Set(roles)].join(', '),
        percentage: ubo.percentOwned,
        isBeneficial: true,
        isAboveThreshold,
        isLinkedIndividual: uboIsLinked,
        verificationStatus: uboIsLinked ? getIndividualVerificationStatus(id, ubo.name) : undefined,
        onEdit: callbacks.onEdit,
        onRemove: callbacks.onRemove,
      },
    });

    edges.push({
      id: `e-${rootId}-${id}`,
      source: rootId,
      target: id,
      type: 'offsetSmooth',
      style: { stroke: '#22c55e', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
      label: ubo.percentOwned != null ? `${ubo.percentOwned}% BH` : undefined,
      labelStyle: { fontSize: 11, fontWeight: 600, fill: '#22c55e' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
    });
  }

  // Blocking entities not already in shareholders
  for (const be of blockingEntities) {
    if (addedIds.has(be.entityId)) continue;
    addedIds.add(be.entityId);

    nodes.push({
      id: be.entityId,
      type: 'organisation',
      position: { x: 0, y: 0 },
      data: {
        label: be.name,
        nodeType: 'organisation',
        percentage: be.percentageOwned?.total,
        isBlocking: true,
        blockingReasons: be.reasons?.map((r) => r.description).filter(Boolean),
        onEdit: callbacks.onEdit,
        onRemove: callbacks.onRemove,
      },
    });

    const beBeneficial = (be.percentageOwned?.beneficially ?? 0) > 0;
    const beEdgeColor = beBeneficial ? '#22c55e' : '#ef4444';
    edges.push({
      id: `e-${rootId}-${be.entityId}`,
      source: rootId,
      target: be.entityId,
      type: 'offsetSmooth',
      animated: true,
      style: { stroke: beEdgeColor, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: beEdgeColor },
      label: be.percentageOwned?.total != null ? `${be.percentageOwned.total}% ${beBeneficial ? 'BH' : 'NBH'}` : undefined,
      labelStyle: { fontSize: 11, fontWeight: 600, fill: beEdgeColor },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
    });

    // Add UBOs from blocking entity
    const beUbos = be.ubos || [];
    for (const ubo of beUbos) {
      const ubId = ubo.entityId || `${be.entityId}-${ubo.name}`;
      if (addedIds.has(ubId)) continue;
      addedIds.add(ubId);

      const roles: string[] = [];
      const extra = ubo.entityId ? officeholderRoles[ubo.entityId] : undefined;
      if (extra && extra.length > 0) roles.push(...extra);
      roles.push('UBO');

      const pctVal = ubo.percentOwned ?? 0;
      const isAboveThreshold = pctVal >= BENEFICIAL_THRESHOLD;

      const beUboIsLinked = isLinkedToIndividualsList(ubId, ubo.name);

      nodes.push({
        id: ubId,
        type: 'individual',
        position: { x: 0, y: 0 },
        data: {
          label: ubo.name,
          nodeType: 'individual',
          role: [...new Set(roles)].join(', '),
          percentage: ubo.percentOwned,
          isBeneficial: true,
          isAboveThreshold,
          isLinkedIndividual: beUboIsLinked,
          verificationStatus: beUboIsLinked ? getIndividualVerificationStatus(ubId, ubo.name) : undefined,
          onEdit: callbacks.onEdit,
          onRemove: callbacks.onRemove,
          onNodeClick: callbacks.onNodeClick,
        },
      });

      edges.push({
        id: `e-${be.entityId}-${ubId}`,
        source: be.entityId,
        target: ubId,
        type: 'offsetSmooth',
        style: { stroke: '#22c55e', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
        label: ubo.percentOwned != null ? `${ubo.percentOwned}% BH` : undefined,
        labelStyle: { fontSize: 11, fontWeight: 600, fill: '#22c55e' },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      });
    }
  }

  // Directors/officers not already shown
  for (const officer of ownership.officeholders || []) {
    const id = officer.entityId || officer.name;
    if (addedIds.has(id)) continue;
    addedIds.add(id);

    const officerIsLinked = isLinkedToIndividualsList(id, officer.name);

    nodes.push({
      id,
      type: 'individual',
      position: { x: 0, y: 0 },
      data: {
        label: officer.name,
        nodeType: 'individual',
        role: formatRole(officer.role || ''),
        isBeneficial: false,
        isAboveThreshold: false,
        isLinkedIndividual: officerIsLinked,
        verificationStatus: officerIsLinked ? getIndividualVerificationStatus(id, officer.name) : undefined,
        onEdit: callbacks.onEdit,
        onRemove: callbacks.onRemove,
      },
    });

    edges.push({
      id: `e-${rootId}-${id}`,
      source: rootId,
      target: id,
      type: 'offsetSmooth',
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 5' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    });
  }

  // Add trust nodes if a trust is associated with an org
  if (trustData?.trustLinkedOrgId && trustData?.trustAnalysisResults) {
    const linkedOrgId = trustData.trustLinkedOrgId;
    for (const [, trustResult] of Object.entries(trustData.trustAnalysisResults)) {
      const trustNodeId = `trust-${trustResult.documentId || 'main'}`;
      if (addedIds.has(trustNodeId)) continue;
      addedIds.add(trustNodeId);

      nodes.push({
        id: trustNodeId,
        type: 'trust',
        position: { x: 0, y: 0 },
        data: {
          label: trustResult.trustName || 'Trust',
          nodeType: 'trust',
        },
      });

      edges.push({
        id: `e-${linkedOrgId}-${trustNodeId}`,
        source: linkedOrgId,
        target: trustNodeId,
        type: 'offsetSmooth',
        style: { stroke: '#eab308', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#eab308' },
        label: 'Trust',
        labelStyle: { fontSize: 11, fontWeight: 600, fill: '#a16207' },
        labelBgStyle: { fill: '#fefce8', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      });

      // Build multiple name-based lookups for individuals list (to match across different ID/name formats)
      const individualsFullNameMap = new Map<string, Individual>(); // "given middle family"
      const individualsShortNameMap = new Map<string, Individual>(); // "given family" (no middle)
      const individualsFamilyMap = new Map<string, Individual[]>(); // family name -> individuals
      for (const ind of (trustData.individuals || [])) {
        const fullKey = `${ind.givenName} ${ind.middleName || ''} ${ind.familyName}`.replace(/\s+/g, ' ').trim().toLowerCase();
        const shortKey = `${ind.givenName} ${ind.familyName}`.trim().toLowerCase();
        const familyKey = ind.familyName.toLowerCase().trim();
        if (fullKey) individualsFullNameMap.set(fullKey, ind);
        if (shortKey) individualsShortNameMap.set(shortKey, ind);
        if (familyKey) {
          if (!individualsFamilyMap.has(familyKey)) individualsFamilyMap.set(familyKey, []);
          individualsFamilyMap.get(familyKey)!.push(ind);
        }
      }

      function findLinkedIndividual(trustInd: { name: { givenName?: string; familyName?: string; middleName?: string; displayName?: string } }): Individual | undefined {
        const given = (trustInd.name.givenName || '').toLowerCase().trim();
        const family = (trustInd.name.familyName || '').toLowerCase().trim();
        const middle = (trustInd.name.middleName || '').toLowerCase().trim();
        const display = (trustInd.name.displayName || '').toLowerCase().trim();

        // Try full name with middle
        if (given && family) {
          const fullKey = `${given} ${middle} ${family}`.replace(/\s+/g, ' ').trim();
          if (individualsFullNameMap.has(fullKey)) return individualsFullNameMap.get(fullKey);
        }
        // Try short name (given + family only)
        const shortKey = `${given} ${family}`.trim();
        if (shortKey && individualsShortNameMap.has(shortKey)) return individualsShortNameMap.get(shortKey);
        // Try display name directly
        if (display && individualsFullNameMap.has(display)) return individualsFullNameMap.get(display);
        if (display && individualsShortNameMap.has(display)) return individualsShortNameMap.get(display);
        // Try matching family name + first name starts with given
        if (family && given && individualsFamilyMap.has(family)) {
          const candidates = individualsFamilyMap.get(family)!;
          const match = candidates.find(c => c.givenName.toLowerCase().startsWith(given) || given.startsWith(c.givenName.toLowerCase()));
          if (match) return match;
        }
        return undefined;
      }

      function getVerificationStatus(trustInd: { name: { givenName?: string; familyName?: string; displayName?: string } }): string | undefined {
        const linked = findLinkedIndividual(trustInd);
        if (!linked) return undefined;
        if (!trustData!.kycResults || trustData!.kycResults.size === 0) return 'pending';
        const result = trustData!.kycResults.get(linked.id);
        if (!result) return 'pending';
        const s = (result.overallResult || result.status || '').toLowerCase();
        if (s.includes('pass') || s.includes('clear')) return 'pass';
        if (s.includes('fail') || s.includes('reject') || s.includes('error')) return 'fail';
        if (s.includes('review') || s.includes('refer')) return 'review';
        return 'pending';
      }

      // Build a name-based lookup for existing nodes to detect duplicates
      const existingNodeNames = new Map<string, string>(); // lowercase name -> node id
      for (const n of nodes) {
        if (n.data.label) {
          existingNodeNames.set(n.data.label.toLowerCase().trim(), n.id);
        }
      }

      const getRolesForTrustEntity = (entityId: string): string[] => {
        const r: string[] = [];
        if (trustResult.settlors.some(s => s.entityId === entityId)) r.push('Settlor');
        if (trustResult.trustees.some(t => t.entityId === entityId)) r.push('Trustee');
        if (trustResult.appointors.some(a => a.entityId === entityId)) r.push('Appointor');
        if (trustResult.specifiedBeneficiaries.some(b => b.entityId === entityId)) r.push('Beneficiary');
        return r;
      };

      // Add trust individuals — skip if they already exist on the tree (match by name)
      for (const [indId, ind] of Object.entries(trustResult.linkedIndividuals)) {
        const indName = (ind.name.displayName || `${ind.name.givenName || ''} ${ind.name.familyName || ''}`.trim());
        const indNameLower = indName.toLowerCase().trim();
        const roles = getRolesForTrustEntity(indId);
        const isLinked = !!findLinkedIndividual(ind);
        const vStatus = getVerificationStatus(ind);

        // If this person already exists on the tree as a regular node, just enrich it — don't add a second edge
        const existingNodeId = existingNodeNames.get(indNameLower);
        if (existingNodeId) {
          const existingNode = nodes.find(n => n.id === existingNodeId);
          if (existingNode) {
            // Add trust role info and linked status to the existing node without changing its type or edges
            existingNode.data = {
              ...existingNode.data,
              trustRole: roles.join(', ') || undefined,
              isLinkedIndividual: existingNode.data.isLinkedIndividual || isLinked,
              verificationStatus: existingNode.data.verificationStatus || (isLinked ? vStatus : undefined),
              onNodeClick: callbacks.onNodeClick,
            };
          }
          continue;
        }

        const nodeId = `trust-ind-${indId}`;
        if (addedIds.has(nodeId)) continue;
        addedIds.add(nodeId);

        nodes.push({
          id: nodeId,
          type: 'trustIndividual',
          position: { x: 0, y: 0 },
          data: {
            label: indName,
            nodeType: 'trustIndividual',
            trustRole: roles.join(', ') || 'Member',
            isLinkedIndividual: isLinked,
            verificationStatus: isLinked ? vStatus : undefined,
            onNodeClick: callbacks.onNodeClick,
          },
        });

        edges.push({
          id: `e-${trustNodeId}-${nodeId}`,
          source: trustNodeId,
          target: nodeId,
          type: 'offsetSmooth',
          style: { stroke: '#facc15', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#facc15' },
        });
      }

      // Add trust organizations — skip if they already exist on the tree
      for (const [orgId, org] of Object.entries(trustResult.linkedOrganizations)) {
        const orgName = org.details?.name?.value || orgId;
        const orgNameLower = orgName.toLowerCase().trim();
        const roles = getRolesForTrustEntity(orgId);

        const existingNodeId = existingNodeNames.get(orgNameLower);
        if (existingNodeId) {
          // Add edge from trust to existing org node
          edges.push({
            id: `e-${trustNodeId}-${existingNodeId}`,
            source: trustNodeId,
            target: existingNodeId,
            type: 'offsetSmooth',
            style: { stroke: '#facc15', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#facc15' },
          });
          continue;
        }

        const nodeId = `trust-org-${orgId}`;
        if (addedIds.has(nodeId)) continue;
        addedIds.add(nodeId);

        nodes.push({
          id: nodeId,
          type: 'trustIndividual',
          position: { x: 0, y: 0 },
          data: {
            label: orgName,
            nodeType: 'trustIndividual',
            trustRole: roles.join(', ') || 'Organisation',
            onNodeClick: callbacks.onNodeClick,
          },
        });

        edges.push({
          id: `e-${trustNodeId}-${nodeId}`,
          source: trustNodeId,
          target: nodeId,
          type: 'offsetSmooth',
          style: { stroke: '#facc15', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#facc15' },
        });
      }
    }
  }

  // Add placeholder nodes
  if (callbacks.onAdd) {
    const parentIds = nodes
      .filter((n) => n.type === 'company' || n.type === 'organisation')
      .map((n) => ({ id: n.id, label: n.data.label }));

    const placeholderNodes: Node<OwnershipNodeData>[] = [];
    const placeholderEdges: Edge[] = [];
    for (const parent of parentIds) {
      const placeholderId = `add-placeholder-${parent.id}`;
      placeholderNodes.push({
        id: placeholderId,
        type: 'addPlaceholder',
        position: { x: 0, y: 0 },
        data: {
          label: parent.label,
          nodeType: 'individual',
          onAdd: callbacks.onAdd,
        },
      });
      placeholderEdges.push({
        id: `e-${parent.id}-${placeholderId}`,
        source: parent.id,
        target: placeholderId,
        type: 'offsetSmooth',
        style: { stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
      });
    }
    nodes.unshift(...placeholderNodes);
    edges.unshift(...placeholderEdges);
  }

  // Joint group placeholder nodes
  const JOINT_GROUP_PAD = 8;
  const JOINT_GROUP_GAP = 12;
  const JOINT_GROUP_WIDTH = NODE_WIDTH * 2 + JOINT_GROUP_GAP + JOINT_GROUP_PAD * 2;
  const JOINT_GROUP_HEIGHT = (NODE_HEIGHTS.individual || 80) + JOINT_GROUP_PAD * 2 + 16;
  for (const [groupId, members] of jointGroups) {
    if (members.length < 2) continue;
    nodes.push({
      id: `joint-group-${groupId}`,
      type: 'jointGroup',
      position: { x: 0, y: 0 },
      data: { label: 'Joint Holders', nodeType: 'individual' },
      style: { width: JOINT_GROUP_WIDTH, height: JOINT_GROUP_HEIGHT },
      zIndex: -1,
    });
  }

  // Apply dagre layout
  const laid = layoutGraph(nodes, edges);

  // Post-process: position joint holder members inside group box
  const nodeMap = new Map<string, Node<OwnershipNodeData>>();
  for (const n of laid) nodeMap.set(n.id, n);

  for (const [groupId, members] of jointGroups) {
    if (members.length < 2) continue;
    const groupNode = nodeMap.get(`joint-group-${groupId}`);
    if (!groupNode) continue;

    const gx = groupNode.position.x;
    const gy = groupNode.position.y;

    for (let i = 0; i < members.length; i++) {
      const memberNode = nodeMap.get(members[i]);
      if (memberNode) {
        memberNode.position = {
          x: gx + JOINT_GROUP_PAD + i * (NODE_WIDTH + JOINT_GROUP_GAP),
          y: gy + JOINT_GROUP_PAD + 16,
        };
      }
    }
  }

  // Post-process: ensure add-placeholder nodes are leftmost
  for (const n of laid) {
    if (n.id.startsWith('add-placeholder-')) {
      const parentId = n.id.replace('add-placeholder-', '');
      const siblingIds = edges
        .filter(e => e.source === parentId)
        .map(e => e.target);
      let leftmostNode: Node<OwnershipNodeData> | undefined;
      let leftmostX = Infinity;
      for (const sibId of siblingIds) {
        const sib = nodeMap.get(sibId);
        if (sib && sib.position.x < leftmostX) {
          leftmostX = sib.position.x;
          leftmostNode = sib;
        }
      }
      if (leftmostNode && leftmostNode.id !== n.id) {
        const tmpX = n.position.x;
        n.position.x = leftmostNode.position.x;
        leftmostNode.position.x = tmpX;
      }
    }
  }

  // Post-process edges: spread source points and stagger heights
  const edgesBySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, []);
    edgesBySource.get(edge.source)!.push(edge);
  }

  const BASE_OFFSET = 20;
  const OFFSET_STEP = 12;

  for (const [sourceId, sourceEdges] of edgesBySource) {
    const sourceNode = nodeMap.get(sourceId);
    if (!sourceNode) continue;
    const sourceW = sourceNode.style?.width ? Number(sourceNode.style.width) : NODE_WIDTH;
    const sourceCenterX = sourceNode.position.x + sourceW / 2;

    const sorted = sourceEdges.map((e) => {
      const targetNode = nodeMap.get(e.target);
      const targetW = targetNode?.style?.width ? Number(targetNode.style.width) : NODE_WIDTH;
      const targetCenterX = targetNode ? targetNode.position.x + targetW / 2 : sourceCenterX;
      return { edge: e, targetCenterX, dist: Math.abs(targetCenterX - sourceCenterX) };
    });
    sorted.sort((a, b) => a.targetCenterX - b.targetCenterX);

    const spreadWidth = sourceW * 0.8;
    const count = sorted.length;

    const left = sorted.filter(s => s.targetCenterX < sourceCenterX - 1);
    const right = sorted.filter(s => s.targetCenterX > sourceCenterX + 1);
    const center = sorted.filter(s => Math.abs(s.targetCenterX - sourceCenterX) <= 1);
    left.sort((a, b) => b.dist - a.dist);
    right.sort((a, b) => b.dist - a.dist);

    const maxSide = Math.max(left.length, right.length);
    for (let i = 0; i < left.length; i++) {
      left[i].edge.data = { ...(left[i].edge.data || {}), offset: BASE_OFFSET + i * OFFSET_STEP };
    }
    for (let i = 0; i < right.length; i++) {
      right[i].edge.data = { ...(right[i].edge.data || {}), offset: BASE_OFFSET + i * OFFSET_STEP };
    }
    const centerOffset = BASE_OFFSET + maxSide * OFFSET_STEP;
    for (const item of center) {
      item.edge.data = { ...(item.edge.data || {}), offset: centerOffset };
    }

    const GAP = 16;
    const totalSpan = (count - 1) * GAP;
    const clampedSpan = Math.min(totalSpan, spreadWidth);
    for (let i = 0; i < count; i++) {
      const xOffset = count === 1 ? 0 : -clampedSpan / 2 + (clampedSpan / (count - 1)) * i;
      sorted[i].edge.data = { ...(sorted[i].edge.data || {}), sourceXOffset: xOffset };
    }
  }

  return { nodes: laid, edges, rootId };
}

// ─── Main Component ─────────────────────────────────────────────────

export function OwnershipTree({ ownership, blockingEntities, onAddNode, onEditNode, onRemoveNode, onEntityAdded, trustAnalysisResults, trustLinkedOrgId, onTrustLinkOrg, individuals, kycResults }: OwnershipTreeProps) {
  const [addModal, setAddModal] = useState<{ parentEntityId: string; parentName: string } | null>(null);
  const [detailModal, setDetailModal] = useState<{
    entityId: string;
    entityName: string;
    entityType: 'individual' | 'organisation' | 'company';
    role?: string;
    percentage?: number;
  } | null>(null);

  const handleAddToNode = useCallback((nodeId: string, label: string) => {
    setAddModal({ parentEntityId: nodeId, parentName: label });
  }, []);

  const handleNodeClick = useCallback((nodeId: string, data: OwnershipNodeData) => {
    if (data.nodeType === 'individual' || data.nodeType === 'organisation') {
      setDetailModal({
        entityId: nodeId,
        entityName: data.label,
        entityType: data.nodeType,
        role: data.role,
        percentage: data.percentage,
      });
    }
  }, []);

  const callbacks = useMemo(() => ({
    onEdit: onEditNode,
    onRemove: onRemoveNode,
    onAdd: handleAddToNode,
    onNodeClick: handleNodeClick,
    onLinkTrust: onTrustLinkOrg,
  }), [onEditNode, onRemoveNode, handleAddToNode, handleNodeClick, onTrustLinkOrg]);

  const trustData = useMemo(() => ({
    trustAnalysisResults,
    trustLinkedOrgId,
    individuals,
    kycResults,
  }), [trustAnalysisResults, trustLinkedOrgId, individuals, kycResults]);

  const { nodes: initialNodes, edges: initialEdges, rootId } = useMemo(
    () => buildGraph(ownership, blockingEntities, callbacks, trustData),
    [ownership, blockingEntities, callbacks, trustData]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync ReactFlow state when ownership data changes (e.g. after adding an entity)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const hasNodes = initialNodes.length > 1;

  const defaultViewport = useMemo(() => {
    const rootNode = initialNodes.find(n => n.id === rootId);
    if (!rootNode) return { x: 0, y: 0, zoom: 1 };
    const zoom = 1;
    const x = -(rootNode.position.x + NODE_WIDTH / 2) * zoom + 400;
    const y = -(rootNode.position.y) * zoom + 20;
    return { x, y, zoom };
  }, [initialNodes, rootId]);

  if (!hasNodes) return null;

  return (
    <div className="bg-white rounded-xl border border-wise-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="font-bold text-wise-navy text-lg">Ownership Structure</h3>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 pb-3 text-[10px] text-wise-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-emerald-500" /> Beneficial
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-red-500" /> Non-beneficial / Blocking
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-dashed border-gray-400" /> Director only
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> Below 25%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Blocking Entity
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-dashed border-amber-400" /> Joint holders
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-2.5 rounded-sm border-2 border-dashed border-gray-300" /> Add entity
        </span>
        {trustAnalysisResults && Object.keys(trustAnalysisResults).length > 0 && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-4 border-t-2 border-yellow-400" /> Trust
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border-2 border-green-400 bg-green-50" /> Linked
            </span>
          </>
        )}
      </div>

      <div style={{ height: Math.min(800, Math.max(400, initialNodes.length * 110)) }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={defaultViewport}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#f1f5f9" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {addModal && (
        <AddEntityModal
          parentEntityId={addModal.parentEntityId}
          parentName={addModal.parentName}
          rootEntityId={rootId}
          onClose={() => setAddModal(null)}
          onAdded={(entity) => {
            const parentId = addModal.parentEntityId;
            setAddModal(null);
            onEntityAdded?.(parentId, entity);
          }}
        />
      )}

      {detailModal && (
        <EntityDetailModal
          entityId={detailModal.entityId}
          entityName={detailModal.entityName}
          entityType={detailModal.entityType}
          role={detailModal.role}
          percentage={detailModal.percentage}
          onClose={() => setDetailModal(null)}
          onUpdated={() => {}}
          hasTrust={!!(trustAnalysisResults && Object.keys(trustAnalysisResults).length > 0) && (detailModal.entityType === 'organisation' || detailModal.entityType === 'company')}
          isTrustLinked={trustLinkedOrgId === detailModal.entityId}
          onLinkTrust={(orgId) => {
            onTrustLinkOrg?.(orgId);
            setDetailModal(null);
          }}
          onUnlinkTrust={() => {
            onTrustLinkOrg?.('');
            setDetailModal(null);
          }}
        />
      )}
    </div>
  );
}
