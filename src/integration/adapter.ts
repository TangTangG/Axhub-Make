/**
 * 上游适配器
 * 适配上游 Axhub-Make API 数据格式
 * @version 1.0.0
 */

import type { ComponentTree, ComponentNode } from '../enhanced/components/types';
import type {
  UpstreamAdapter,
  UpstreamVersion,
  UpstreamProjectData,
  UpstreamPage,
  UpstreamElement,
} from './types';

export class AxhubMakeAdapter implements UpstreamAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<UpstreamVersion> {
    const res = await fetch(`${this.baseUrl}/api/version`);
    if (!res.ok) {
      throw new Error(`Failed to get upstream version: ${res.status}`);
    }
    return res.json();
  }

  convertToComponentTree(upstreamData: UpstreamProjectData): ComponentTree {
    const firstPage = upstreamData.pages[0];
    if (!firstPage) {
      throw new Error('Upstream project has no pages');
    }

    return {
      id: `tree-${firstPage.id}`,
      name: firstPage.name,
      root: this.convertElementsToNode(firstPage.elements),
    };
  }

  convertFromComponentTree(tree: ComponentTree): UpstreamProjectData {
    return {
      version: '1.0',
      pages: [
        {
          id: tree.id,
          name: tree.name,
          elements: this.convertNodeToElements(tree.root),
        },
      ],
    };
  }

  private convertElementsToNode(elements: UpstreamElement[]): ComponentNode {
    if (elements.length === 0) {
      return { id: 'root', type: 'proto-rectangle', props: {} };
    }

    const root = elements[0];
    return {
      id: root.id,
      type: this.mapUpstreamType(root.type),
      props: root.props,
      children: root.children?.map((child) => this.convertSingleElement(child)),
    };
  }

  private convertSingleElement(element: UpstreamElement): ComponentNode {
    return {
      id: element.id,
      type: this.mapUpstreamType(element.type),
      props: element.props,
      children: element.children?.map((child) => this.convertSingleElement(child)),
    };
  }

  private convertNodeToElements(node: ComponentNode): UpstreamElement[] {
    return [
      {
        id: node.id,
        type: this.mapToUpstreamType(node.type),
        props: node.props,
        children: node.children?.map((child) => this.convertSingleNode(child)),
      },
    ];
  }

  private convertSingleNode(node: ComponentNode): UpstreamElement {
    return {
      id: node.id,
      type: this.mapToUpstreamType(node.type),
      props: node.props,
      children: node.children?.map((child) => this.convertSingleNode(child)),
    };
  }

  private mapUpstreamType(upstreamType: string): string {
    const typeMap: Record<string, string> = {
      rect: 'proto-rectangle',
      text: 'proto-text',
      button: 'proto-button',
      input: 'proto-input',
      image: 'proto-image',
      link: 'proto-link',
      select: 'proto-select',
      radio: 'proto-radio',
      checkbox: 'proto-checkbox',
      table: 'proto-table',
      switch: 'proto-switch',
      slider: 'proto-slider',
      datepicker: 'proto-date-picker',
      nav: 'proto-nav',
      tabs: 'proto-tabs',
      card: 'proto-card',
      divider: 'proto-divider',
      grid: 'proto-grid',
      modal: 'proto-modal',
      drawer: 'proto-drawer',
      chart: 'proto-chart',
      map: 'proto-map',
      richtext: 'proto-rich-text',
    };
    return typeMap[upstreamType] ?? upstreamType;
  }

  private mapToUpstreamType(type: string): string {
    const typeMap: Record<string, string> = {
      'proto-rectangle': 'rect',
      'proto-text': 'text',
      'proto-button': 'button',
      'proto-input': 'input',
      'proto-image': 'image',
      'proto-link': 'link',
      'proto-select': 'select',
      'proto-radio': 'radio',
      'proto-checkbox': 'checkbox',
      'proto-table': 'table',
      'proto-switch': 'switch',
      'proto-slider': 'slider',
      'proto-date-picker': 'datepicker',
      'proto-nav': 'nav',
      'proto-tabs': 'tabs',
      'proto-card': 'card',
      'proto-divider': 'divider',
      'proto-grid': 'grid',
      'proto-modal': 'modal',
      'proto-drawer': 'drawer',
      'proto-chart': 'chart',
      'proto-map': 'map',
      'proto-rich-text': 'richtext',
    };
    return typeMap[type] ?? type;
  }
}
