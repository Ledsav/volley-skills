import { NotFoundState } from '../components/NotFoundState';
import { usePageMeta } from '../layout/usePageMeta';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DiagramEditorView } from './DiagramEditorView';
import { useDiagramEditor } from './useDiagramEditor';
import { useT } from '../i18n/I18nProvider';

export function DiagramEditorPage() {
  const ed = useT().diagrams.editor;
  usePageMeta({ title: ed.pageTitle });
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';
  const { state, activeDiagram, dispatch, save, status, loadError, notFound, saveError } = useDiagramEditor(exerciseId, uid);

  if (notFound) {
    return <NotFoundState title={ed.notFoundTitle} message={ed.notFoundMessage} backTo="/exercises" backLabel={ed.allExercises} />;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <p role="alert" className="text-red-strong">{loadError}</p>
        <Link to="/exercises" className="mt-3 inline-block text-ink underline">{ed.backToExercisesLink}</Link>
      </div>
    );
  }

  return (
    <DiagramEditorView
      state={state}
      activeDiagram={activeDiagram}
      dispatch={dispatch}
      save={save}
      status={status}
      saveError={saveError}
      onExit={() => navigate('/exercises')}
    />
  );
}
