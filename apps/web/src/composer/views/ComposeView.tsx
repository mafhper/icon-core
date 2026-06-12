import { Topbar } from '../components/Topbar';
import { LayerList } from '../components/LayerList';
import { LayerInspector } from '../components/LayerInspector';
import { PreviewCanvas } from '../components/PreviewCanvas';
import { SizeStrip } from '../components/SizeStrip';
import { QualityWarnings } from '../components/QualityWarnings';

export const ComposeView = () => {
  return (
    <div className="h-screen flex flex-col">
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        <LayerList />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PreviewCanvas />
          <QualityWarnings />
          <SizeStrip />
        </div>
        <LayerInspector />
      </div>
    </div>
  );
};