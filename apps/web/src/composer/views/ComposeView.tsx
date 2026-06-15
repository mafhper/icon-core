import { Topbar } from '../components/Topbar';
import { LayerList } from '../components/LayerList';
import { LayerInspector } from '../components/LayerInspector';
import { PreviewCanvas } from '../components/PreviewCanvas';
import { AppearanceBar } from '../components/AppearanceBar';

export const ComposeView = () => {
  return (
    <div className="ic-editor-shell">
      <Topbar />
      <div className="ic-editor-body">
        <LayerList />
        <div className="ic-editor-main">
          <PreviewCanvas />
          <AppearanceBar />
        </div>
        <LayerInspector />
      </div>
    </div>
  );
};
