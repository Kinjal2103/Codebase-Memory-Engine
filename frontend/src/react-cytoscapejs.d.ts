// src/react-cytoscapejs.d.ts
declare module "react-cytoscapejs" {
  import { Component } from "react";
  import { Core, Stylesheet } from "cytoscape";

  interface CytoscapeComponentProps {
    id?: string;
    elements: any[];
    style?: React.CSSProperties;
    layout?: any;
    stylesheet?: Stylesheet[] | any;
    cy?: (cy: Core) => void;
    className?: string;
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}
