"use client";

/**
 * OrthoOdontogram is a controlled component for the tooth-circle chart.
 *
 * Value shape:
 *   OrthoChartState = {
 *     teeth: Record<FDIToothCode, ToothState>;
 *     supernumeraryNote: string;
 *   }
 *
 * Store this object directly as JSON (e.g. inside OrthoCard.data.toothChart).
 */

import React, { useReducer, useEffect, useCallback } from "react";
import {
  type OrthoChartState,
  type FDIToothCode,
} from "../../types/orthoChart";
import { ToothSvg } from "./ToothSvg";
import { ToothPopover } from "./ToothPopover";
import {
  orthoReducer,
  createInitialReducerState,
  type OrthoReducerState,
  type OrthoAction,
} from "../../utils/orthoChartRules";

export interface OrthoOdontogramProps {
  value?: OrthoChartState;
  onChange?: (value: OrthoChartState) => void;
}

const upperRight: FDIToothCode[] = ["11", "12", "13", "14", "15", "16", "17"];
const upperLeft: FDIToothCode[] = ["21", "22", "23", "24", "25", "26", "27"];
const lowerLeft: FDIToothCode[] = ["31", "32", "33", "34", "35", "36", "37"];
const lowerRight: FDIToothCode[] = ["41", "42", "43", "44", "45", "46", "47"];

export function OrthoOdontogram({ value, onChange }: OrthoOdontogramProps) {
  const [state, dispatch] = useReducer<
    (s: OrthoReducerState, a: OrthoAction) => OrthoReducerState
  >(orthoReducer, createInitialReducerState(value));

  useEffect(() => {
    if (!onChange) return;
    const { popover, ...pure } = state;
    onChange(pure);
  }, [state, onChange]);

  const openPopover = useCallback(
    (toothCode: FDIToothCode, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      dispatch({ type: "OPEN_POPOVER", toothCode, anchorRect: rect });
    },
    []
  );

  const popTooth =
    state.popover.toothCode != null
      ? state.teeth[state.popover.toothCode]
      : null;

  return (
    <div style={{ fontFamily: "sans-serif", fontSize: 13, position: "relative" }}>
      {/* Supernumerary note */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>
          Супернумерар шүдний байрлал
        </div>
        <textarea
          value={state.supernumeraryNote}
          onChange={(e) =>
            dispatch({ type: "SET_SUPERNUMERARY_NOTE", text: e.target.value })
          }
          rows={2}
          placeholder='Жишээ: "between 12–13"'
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: 6,
            resize: "vertical",
          }}
        />
      </div>

      {/* Upper arch */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4, color: "#6b7280" }}>Дээд эрүү</div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          {upperRight.map((code) => {
            const t = state.teeth[code];
            return (
              <div key={code} style={{ textAlign: "center" }}>
                <ToothSvg
                  baseStatus={t.baseStatus}
                  caries={t.caries}
                  filled={t.filled}
                  onToothClick={(e) => openPopover(code, e)}
                />
                <div style={{ fontSize: 11, marginTop: 2 }}>{code}</div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {upperLeft.map((code) => {
            const t = state.teeth[code];
            return (
              <div key={code} style={{ textAlign: "center" }}>
                <ToothSvg
                  baseStatus={t.baseStatus}
                  caries={t.caries}
                  filled={t.filled}
                  onToothClick={(e) => openPopover(code, e)}
                />
                <div style={{ fontSize: 11, marginTop: 2 }}>{code}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lower arch */}
      <div>
        <div style={{ marginBottom: 4, color: "#6b7280" }}>Доод эрүү</div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          {lowerLeft.map((code) => {
            const t = state.teeth[code];
            return (
              <div key={code} style={{ textAlign: "center" }}>
                <ToothSvg
                  baseStatus={t.baseStatus}
                  caries={t.caries}
                  filled={t.filled}
                  onToothClick={(e) => openPopover(code, e)}
                />
                <div style={{ fontSize: 11, marginTop: 2 }}>{code}</div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {lowerRight.map((code) => {
            const t = state.teeth[code];
            return (
              <div key={code} style={{ textAlign: "center" }}>
                <ToothSvg
                  baseStatus={t.baseStatus}
                  caries={t.caries}
                  filled={t.filled}
                  onToothClick={(e) => openPopover(code, e)}
                />
                <div style={{ fontSize: 11, marginTop: 2 }}>{code}</div>
              </div>
            );
          })}
        </div>
      </div>

      {state.popover.open && state.popover.toothCode && popTooth && (
        <ToothPopover
          anchorRect={state.popover.anchorRect}
          toothCode={state.popover.toothCode}
          toothState={popTooth}
          overlayMode={state.popover.overlayMode}
          onClose={() => dispatch({ type: "CLOSE_POPOVER" })}
          onSetBaseStatus={(status) =>
            dispatch({
              type: "SET_BASE_STATUS",
              toothCode: state.popover.toothCode as FDIToothCode,
              status,
            })
          }
          onSetOverlayMode={(mode) =>
            dispatch({ type: "SET_ACTIVE_OVERLAY_MODE", overlayMode: mode })
          }
          onToggleSurface={(mode, surface) =>
            dispatch({
              type: "TOGGLE_SURFACE",
              toothCode: state.popover.toothCode as FDIToothCode,
              mode,
              surface,
            })
          }
          onChangeNote={(note) =>
            dispatch({
              type: "SET_TOOTH_NOTE",
              toothCode: state.popover.toothCode as FDIToothCode,
              note,
            })
          }
          onClearTooth={() =>
            dispatch({
              type: "CLEAR_TOOTH",
              toothCode: state.popover.toothCode as FDIToothCode,
            })
          }
        />
      )}
    </div>
  );
}
