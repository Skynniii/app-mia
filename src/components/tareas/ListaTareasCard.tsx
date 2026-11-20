import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Task, TaskList, SortMode } from '../../types';
import { TareaItem } from './TareaItem';
import { SeparatorItem } from './SeparatorItem';
import { VirtualizedList } from './VirtualizedList';
import { DesplegableMenu } from '../ui/DesplegableMenu';
import { SortMenu } from './SortMenu';
import { useDeviceCapability } from '../../context/DeviceCapabilityContext';
import { useActivities } from '../../hooks/useActivities';

interface Props {
  list: TaskList;
  tasks: Task[];
  allTasks?: Task[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDeleteCompleted: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onUpdateList: (id: string, updates: Partial<TaskList>) => void;
  onReorderListTasks: (listId: string, orderedActive: Task[]) => void;
  onAddSeparator: (listId: string) => void;
  onDeleteSeparators: (listId: string) => void;
  onExpandTask: (id: string) => void;
  onStartActivity: (task: Task) => void;
  isProtected?: boolean;
}

function sortByDateKey(key: 'scheduledDate' | 'dueDate') {
  return (a: Task, b: Task) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av !== 'string' || !av) return 1;
    if (typeof bv !== 'string' || !bv) return -1;
    return av.localeCompare(bv);
  };
}

function isOverdue(dk: string | undefined): boolean {
  if (!dk || typeof dk !== 'string') return false;
  const d = new Date(dk + 'T00:00:00');
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d < t;
}

function groupLabel(dateKey: string | undefined, isDeadline: boolean = false): string {
  if (!dateKey || typeof dateKey !== 'string') return isDeadline ? 'Sin fecha límite' : 'Sin fecha';
  const d = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ListaTareasCard({
  list, tasks, allTasks, onRename, onDelete, onDeleteCompleted, onToggleTask, onUpdateTask, onUpdateList, onReorderListTasks, onAddSeparator, onDeleteSeparators, onExpandTask, onStartActivity, isProtected,
}: Props) {
  const [showCompleted, setShowCompleted] = useState(false);
  const { activities } = useActivities();
  const cap = useDeviceCapability();
  const activityMap = useMemo(() => {
    const m: Record<string, { color: string; name: string }> = {};
    for (const a of activities) m[a.id] = { color: a.color, name: a.name };
    return m;
  }, [activities]);
  const actColor = (t: Task) => {
    if (t.activityId) return activityMap[t.activityId]?.color;
    if (t.isActivityOnly && list.activityId) return activityMap[list.activityId]?.color;
    if (t.linkedTaskId) {
      const linked = (allTasks ?? tasks).find((tk) => tk.id === t.linkedTaskId);
      if (linked?.activityId) return activityMap[linked.activityId]?.color;
    }
    return undefined;
  };
  const actName = (t: Task) => {
    if (t.activityId) return activityMap[t.activityId]?.name;
    if (t.isActivityOnly && list.activityId) return activityMap[list.activityId]?.name;
    if (t.linkedTaskId) {
      const linked = (allTasks ?? tasks).find((tk) => tk.id === t.linkedTaskId);
      if (linked?.activityId) return activityMap[linked.activityId]?.name;
    }
    return undefined;
  };
  // Actividad vinculada a la lista: colorea la línea bajo el título.
  const listActivity = list.activityId ? activityMap[list.activityId] : undefined;

  // --- Modo reordenar + arrastre fluido ---
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ulRef = useRef<HTMLUListElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lpTimer = useRef<number | null>(null);
  const lpCleanup = useRef<(() => void) | null>(null);
  const didDrag = useRef(false);
  const dragOrderRef = useRef<string[] | null>(null);
  const taskByIdRef = useRef<Record<string, Task>>({});
  // Geometría medida una sola vez al empezar a arrastrar: nada de rects por frame.
  const drag = useRef({ startY: 0, height: 0, startTop: 0, ulTop: 0, initScroll: 0, id: '', others: [] as string[], centers: [] as number[], maxY: 0, lastY: 0, frame: 0 });
  const preDragCleanup = useRef<(() => void) | null>(null);

  const sortMode: SortMode = list.sortMode || 'custom';
  const active = tasks.filter((t) => !t.completed);
  const activeNonSep = active.filter((t) => !t.isSeparator);
  // Completadas: la más reciente arriba
  const completed = tasks
    .filter((t) => t.completed)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  const activeSorted = useMemo(() => {
    const arr = [...activeNonSep];
    if (sortMode === 'recent') arr.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    else if (sortMode === 'date') arr.sort(sortByDateKey('scheduledDate'));
    else if (sortMode === 'deadline') arr.sort(sortByDateKey('dueDate'));
    return arr;
  }, [activeNonSep, sortMode]);

  const showGroups = sortMode === 'date' || sortMode === 'deadline';
  const groupKey: 'scheduledDate' | 'dueDate' = sortMode === 'date' ? 'scheduledDate' : 'dueDate';
  const reorderable = reorderMode;

  taskByIdRef.current = Object.fromEntries(active.map((t) => [t.id, t]));

  // En modo personalizado, usa taskOrder de la lista si existe. Las tareas nuevas
  // sin orden se añaden al final, ordenadas por fecha de creación (no por ID de
  // Firestore que es aleatorio). Sin taskOrder, todo se ordena por createdAt.
  const byCreated = (a: Task, b: Task) => (a.createdAt || '').localeCompare(b.createdAt || '');
  const baseIds = sortMode === 'custom' && list.taskOrder
    ? [...list.taskOrder.filter((id) => taskByIdRef.current[id]), ...active.filter((t) => !list.taskOrder!.includes(t.id)).sort(byCreated).map((t) => t.id)]
    : sortMode === 'custom'
      ? [...active].sort(byCreated).map((t) => t.id)
      : activeSorted.map((t) => t.id);
  const orderedIds = dragOrder ?? baseIds;
  // Virtualize long lists in default (non-reorder, non-grouped) mode for performance.
  const shouldVirtualize = !reorderable && !showGroups && orderedIds.length > 30;

  const setDragOrderBoth = useCallback((v: string[] | null) => {
    dragOrderRef.current = v;
    setDragOrder(v);
  }, []);

  /** Mueve la tarjeta arrastrada (transform, sin re-render) y recalcula su hueco. */
  const applyPointer = useCallback((clientY: number) => {
    const d = drag.current;
    const scrollDelta = (scrollRef.current?.scrollTop ?? 0) - d.initScroll;
    // Acotada a la lista: ni por encima del título ni por debajo de completadas.
    const y = Math.min(d.maxY, Math.max(0, d.startTop - d.ulTop + (clientY - d.startY) + scrollDelta));
    if (overlayRef.current) overlayRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
    const yInUl = clientY - d.ulTop + scrollDelta;
    let above = 0;
    for (let i = 0; i < d.centers.length; i += 1) if (yInUl > d.centers[i]) above += 1;
    const cur = dragOrderRef.current;
    if (!cur) return;
    const next = [...d.others.slice(0, above), d.id, ...d.others.slice(above)];
    let changed = next.length !== cur.length;
    if (!changed) {
      for (let i = 0; i < next.length; i += 1) if (next[i] !== cur[i]) { changed = true; break; }
    }
    if (changed) setDragOrderBoth(next);
  }, [setDragOrderBoth]);

  /** Arranca el arrastre de `id` midiendo la lista una sola vez. */
  const startDrag = useCallback((clientY: number, li: HTMLElement, id: string) => {
    const ul = ulRef.current;
    if (!ul) return;
    if (preDragCleanup.current) preDragCleanup.current();
    // Desde el asa se recibe el asa: se mide siempre la tarjeta completa.
    const r = (li.closest('[data-task]') as HTMLElement | null)?.getBoundingClientRect() ?? li.getBoundingClientRect();
    const ulR = ul.getBoundingClientRect();
    const domIds: string[] = [];
    const centersById: Record<string, number> = {};
    ul.querySelectorAll<HTMLElement>('[data-task]').forEach((el) => {
      const tid = el.getAttribute('data-task');
      if (!tid) return;
      domIds.push(tid);
      if (tid === id) return;
      const rr = el.getBoundingClientRect();
      centersById[tid] = rr.top - ulR.top + rr.height / 2;
    });
    const others = domIds.filter((x) => x !== id);
    drag.current = {
      startY: clientY, height: r.height, startTop: r.top, ulTop: ulR.top,
      initScroll: scrollRef.current?.scrollTop ?? 0, id, others,
      centers: others.map((x) => centersById[x] ?? 0),
      maxY: Math.max(0, ulR.height - r.height), lastY: clientY, frame: 0,
    };
    const onTouchMoveBlock = (ev: TouchEvent) => ev.preventDefault();
    didDrag.current = true;
    setDragId(id);
    setDragOrderBoth(domIds);
    window.addEventListener('touchmove', onTouchMoveBlock, { passive: false });
    preDragCleanup.current = () => window.removeEventListener('touchmove', onTouchMoveBlock);
  }, [setDragOrderBoth]);

  const onItemPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (!reorderMode) return;
    startDrag(e.clientY, e.currentTarget as HTMLElement, id);
  }, [reorderMode, startDrag]);

  const onItemPointerEnd = useCallback(() => {
    if (preDragCleanup.current) preDragCleanup.current();
  }, []);

  const clearLongPress = useCallback(() => {
    if (lpTimer.current !== null) { window.clearTimeout(lpTimer.current); lpTimer.current = null; }
    if (lpCleanup.current) { lpCleanup.current(); lpCleanup.current = null; }
  }, []);

  /**
   * En orden personalizado, mantener presionada una tarjeta solo activa el modo
   * ordenar: ninguna tarea entra en arrastre sin tomarla de sus barras.
   */
  const onCardPointerDown = useCallback((e: React.PointerEvent, _id: string) => {
    if (sortMode !== 'custom' || reorderMode) return;
    if (e.button > 0) return;
    clearLongPress();
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 10 || Math.abs(ev.clientY - startY) > 10) clearLongPress();
    };
    const up = () => clearLongPress();
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    lpCleanup.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    lpTimer.current = window.setTimeout(() => {
      lpTimer.current = null;
      if (lpCleanup.current) { lpCleanup.current(); lpCleanup.current = null; }
      setReorderMode(true);
    }, 380);
  }, [sortMode, reorderMode, clearLongPress]);

  const onExpandGuarded = useCallback((id: string) => {
    if (didDrag.current) { didDrag.current = false; return; }
    onExpandTask(id);
  }, [onExpandTask]);

  // Posición inicial de la tarjeta flotante (después se mueve por transform).
  useLayoutEffect(() => {
    if (!dragId || !overlayRef.current) return;
    overlayRef.current.style.transform = `translate3d(0, ${drag.current.startTop - drag.current.ulTop}px, 0)`;
  }, [dragId]);

  useEffect(() => {
    if (!dragId) return;
    const d = drag.current;
    let autoRaf = 0;
    let autoSpeed = 0;

    const autoStep = () => {
      const container = scrollRef.current;
      if (!container || autoSpeed === 0) { autoRaf = 0; return; }
      const max = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.max(0, Math.min(max, container.scrollTop + autoSpeed));
      applyPointer(d.lastY);
      autoRaf = requestAnimationFrame(autoStep);
    };
    const setAuto = (speed: number) => {
      autoSpeed = speed;
      if (speed !== 0 && !autoRaf) autoRaf = requestAnimationFrame(autoStep);
    };

    const onMove = (e: PointerEvent) => {
      d.lastY = e.clientY;
      // Un solo cálculo por frame, aunque el navegador entregue varios eventos.
      if (!d.frame) {
        d.frame = requestAnimationFrame(() => { d.frame = 0; applyPointer(d.lastY); });
      }
      const container = scrollRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const edge = 64;
      if (e.clientY < rect.top + edge) {
        setAuto(-Math.max(4, (1 - (e.clientY - rect.top) / edge) * 16));
      } else if (e.clientY > rect.bottom - edge) {
        setAuto(Math.max(4, ((e.clientY - (rect.bottom - edge)) / edge) * 16));
      } else {
        setAuto(0);
      }
    };

    const finish = () => {
      if (preDragCleanup.current) preDragCleanup.current();
      setAuto(0);
      if (d.frame) { cancelAnimationFrame(d.frame); d.frame = 0; }
      const cur = dragOrderRef.current;
      if (cur) {
        const ordered = cur.map((id) => taskByIdRef.current[id]).filter(Boolean) as Task[];
        if (ordered.length) onReorderListTasks(list.id, ordered);
      }
      setDragId(null);
      setDragOrderBoth(null);
      // El clic que cierra el gesto ya se descartó; si no llega, no se queda pegado.
      window.setTimeout(() => { didDrag.current = false; }, 350);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (autoRaf) cancelAnimationFrame(autoRaf);
      if (d.frame) { cancelAnimationFrame(d.frame); d.frame = 0; }
    };
  }, [dragId, list.id, onReorderListTasks, setDragOrderBoth, applyPointer]);

  // Limpia el temporizador de pulsación larga al desmontar.
  useEffect(() => () => clearLongPress(), [clearLongPress]);

  // Salir del modo reordenar al tocar fuera de la tarjeta
  useEffect(() => {
    if (!reorderMode) return;
    const handler = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setReorderMode(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('pointerdown', handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener('pointerdown', handler); };
  }, [reorderMode]);

  // Estructura para modos con agrupación por fecha (cabeceras + tareas)
  const grouped = showGroups
    ? activeSorted.flatMap((task, i) => {
        const key = task[groupKey];
        const prev = activeSorted[i - 1];
        const items: React.ReactNode[] = [];
        if (!prev || prev[groupKey] !== key) {
          const overdue = isOverdue(key);
          items.push(
            <motion.li
              key={`hdr-${key ?? 'none'}`}
              layout={cap.enableLayout}
              className={`list-none pt-3 first:pt-0 pb-1 text-[12px] font-bold uppercase tracking-wider ${overdue ? 'text-[#e53935]' : 'text-[#a0a0a0]'}`}
            >
              {groupLabel(key, groupKey === 'deadline')}{overdue ? ' · Atrasado' : ''}
            </motion.li>
          );
        }
        items.push(
          <TareaItem key={task.id} task={task} sortMode={sortMode} onToggle={onToggleTask} onUpdate={onUpdateTask} onExpand={onExpandTask} onStartActivity={onStartActivity} activityColor={actColor(task)} activityName={actName(task)} />
        );
        return items;
      })
    : null;

  const draggedTask = dragId ? taskByIdRef.current[dragId] : null;

  return (
    <div ref={scrollRef} style={{ touchAction: reorderMode ? 'pan-y' : undefined }} className="w-full flex-none shrink-0 box-border px-2 snap-start snap-always h-full overflow-y-auto no-scrollbar pb-[80px]" data-lista={list.id}>
      <div ref={cardRef} className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-[#f0f0f3] flex flex-col relative">
        {/* Header sticky */}
        <div className="sticky top-0 z-20">
          <div className="absolute -top-1 -left-1 -right-1 h-[50px] bg-[#f7f6f9] z-10" />
          <div className="relative z-20 bg-white rounded-t-[10px] pt-4 px-3.5">
            <div className="flex justify-between items-center mb-4 flex-none">
              {reorderMode ? (
                <button
                  onClick={() => setReorderMode(false)}
                  title="Salir del modo reordenar"
                  className="bg-transparent border-none text-[#7f70ff] cursor-pointer w-[36px] h-[36px] flex items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              ) : (
                <SortMenu value={sortMode} onChange={(m) => { onUpdateList(list.id, { sortMode: m }); setReorderMode(m === 'custom'); }} />
              )}
              <h3 className="flex-1 text-center leading-none m-0 p-0 text-[21px] text-[#1c1c23] font-bold tracking-[-0.025em]">{list.name}</h3>
              <DesplegableMenu isProtected={isProtected} onRename={() => onRename(list.id, list.name)} onDelete={() => onDelete(list.id)} onDeleteCompleted={() => onDeleteCompleted(list.id)} onAddSeparator={() => onAddSeparator(list.id)} onDeleteSeparators={() => onDeleteSeparators(list.id)} />
            </div>
            <hr className={`m-0 mx-1 flex-none ${listActivity ? 'border-t-2' : 'border-t border-[#f0f0f5]'}`} style={listActivity ? { borderTopColor: listActivity.color } : undefined} />
          </div>
        </div>

        {/* Lista de tareas activas */}
        <div className="flex flex-col px-3.5 pb-3 pt-2">
          {reorderable ? (
            <ul ref={ulRef} className="list-none m-0 p-0 flex flex-col mb-2 relative">
              {orderedIds.map((id) =>
                id === dragId ? (
                  <div key={id} data-placeholder style={{ height: drag.current.height }} className="my-1 rounded-[16px]" />
                ) : taskByIdRef.current[id]?.isSeparator ? (
                  <SeparatorItem
                    key={id}
                    task={taskByIdRef.current[id]}
                    reorderable
                    dragId={dragId}
                    onDragPointerDown={onItemPointerDown}
                    onDragPointerEnd={onItemPointerEnd}
                  />
                ) : (
                  <TareaItem
                    key={id}
                    task={taskByIdRef.current[id]}
                    sortMode={sortMode}
                    reorderable
                    dragId={dragId}
                    onDragPointerDown={onItemPointerDown}
                    onDragPointerEnd={onItemPointerEnd}
                    onToggle={onToggleTask}
                    onUpdate={onUpdateTask}
                    onExpand={onExpandGuarded}
                    onStartActivity={onStartActivity}
                    activityColor={actColor(taskByIdRef.current[id])}
                    activityName={actName(taskByIdRef.current[id])}
                  />
                )
              )}
              {activeNonSep.length === 0 && !dragId && <p className="text-center text-[#a0a0a0] text-sm py-5 font-medium">Lista impecable. Sin pendientes.</p>}
              {draggedTask && (
                <div ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, pointerEvents: 'none', willChange: 'transform' }}>
                  {draggedTask.isSeparator ? (
                    <SeparatorItem task={draggedTask} reorderable dragId={dragId} overlay onDragPointerDown={onItemPointerDown} onDragPointerEnd={onItemPointerEnd} />
                  ) : (
                    <TareaItem task={draggedTask} sortMode={sortMode} reorderable dragId={dragId} overlay onToggle={onToggleTask} onUpdate={onUpdateTask} onExpand={onExpandGuarded} onStartActivity={onStartActivity} activityColor={actColor(draggedTask)} activityName={actName(draggedTask)} />
                  )}
                </div>
              )}
            </ul>
          ) : showGroups ? (
            <ul ref={ulRef} className="list-none m-0 p-0 flex flex-col mb-2 relative">
              <AnimatePresence mode="popLayout">
                {grouped}
              </AnimatePresence>
              {activeNonSep.length === 0 && <p className="text-center text-[#a0a0a0] text-sm py-5 font-medium">Lista impecable. Sin pendientes.</p>}
            </ul>
          ) : shouldVirtualize ? (
            <>
              <VirtualizedList
                scrollRef={scrollRef}
                items={orderedIds}
                getItemKey={(id) => id}
                renderItem={(id) => {
                  const task = taskByIdRef.current[id];
                  if (!task) return null;
                  if (task.isSeparator) return <SeparatorItem task={task} />;
                  return <TareaItem task={task} sortMode={sortMode} onToggle={onToggleTask} onUpdate={onUpdateTask} onExpand={onExpandGuarded} onStartActivity={onStartActivity} onDragPointerDown={onCardPointerDown} onDragPointerEnd={clearLongPress} activityColor={actColor(task)} activityName={actName(task)} />;
                }}
              />
              {activeNonSep.length === 0 && <p className="text-center text-[#a0a0a0] text-sm py-5 font-medium">Lista impecable. Sin pendientes.</p>}
            </>
          ) : (
            <ul ref={ulRef} className="list-none m-0 p-0 flex flex-col mb-2 relative">
              <AnimatePresence mode="popLayout">
                {orderedIds.map((id) => {
                  const task = taskByIdRef.current[id];
                  if (!task) return null;
                  if (task.isSeparator) {
                    return <SeparatorItem key={task.id} task={task} />;
                  }
                  return <TareaItem key={task.id} task={task} sortMode={sortMode} onToggle={onToggleTask} onUpdate={onUpdateTask} onExpand={onExpandGuarded} onStartActivity={onStartActivity} onDragPointerDown={onCardPointerDown} onDragPointerEnd={clearLongPress} activityColor={actColor(task)} activityName={actName(task)} />;
                })}
              </AnimatePresence>
              {activeNonSep.length === 0 && <p className="text-center text-[#a0a0a0] text-sm py-5 font-medium">Lista impecable. Sin pendientes.</p>}
            </ul>
          )}

          {/* Sección completadas */}
          <div className="pt-4">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full flex justify-between items-center bg-[#fcfcfd] border border-[#e8e8ed] rounded-[16px] px-4 py-3 text-[14px] font-medium text-[#777] transition-colors hover:bg-[#f5f5f7]"
            >
              <span>Completadas ({completed.length})</span>
              <svg className={`w-4 h-4 transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-300 ${showCompleted ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden min-h-0">
                <ul className="list-none m-0 mt-3 px-1 flex flex-col relative">
                  <AnimatePresence mode="popLayout">
                    {completed.map((task) => (
                      <TareaItem key={task.id} task={task} onToggle={onToggleTask} onUpdate={onUpdateTask} onExpand={onExpandTask} onStartActivity={onStartActivity} activityColor={actColor(task)} activityName={actName(task)} />
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
