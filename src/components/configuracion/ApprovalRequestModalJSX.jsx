/**
 * ApprovalRequestModalJSX.jsx — Wrapper JSX del ApprovalRequestModal
 *
 * Exportacion.jsx es un archivo .jsx (no TypeScript).
 * Este wrapper re-exporta el modal sin imports de tipos para evitar
 * errores de build al importar desde un archivo JSX.
 *
 * Uso en Exportacion.jsx:
 *
 *   import ApprovalRequestModalJSX from '../configuracion/ApprovalRequestModalJSX';
 *
 *   // Ejemplo: interceptar avance sin documentos
 *   {approvalModal && (
 *     <ApprovalRequestModalJSX
 *       action_key="exportacion.kanban.advance_without_docs"
 *       context_id={embarque.id}
 *       context_data={{
 *         embarque: embarque.codigo,
 *         destino: embarque.destinos[0]?.cliente,
 *         docs_faltantes: faltantes.map(d => d.label).join(', '),
 *         etapa_destino: nextStage.name,
 *       }}
 *       title="Avanzar sin documentos completos"
 *       description="Este embarque tiene documentos obligatorios pendientes. Para avanzar de etapa sin ellos necesitas autorización del administrador."
 *       onClose={() => setApprovalModal(null)}
 *       onApproved={() => {
 *         setApprovalModal(null);
 *         confirmarAvance(); // ejecutar la acción original
 *       }}
 *       onRequested={() => {
 *         setApprovalModal(null);
 *         // toast ya fue mostrado por el hook
 *       }}
 *     />
 *   )}
 */
import ApprovalRequestModal from './ApprovalRequestModal';

export default ApprovalRequestModal;