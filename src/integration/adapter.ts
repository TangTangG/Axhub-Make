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
      return { id: 'root', type: 'rectangle', props: {} };
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
      rect: 'rectangle',
      text: 'text',
      button: 'button',
      input: 'input',
      image: 'image',
      link: 'link',
      select: 'select',
      radio: 'radio',
      checkbox: 'checkbox',
      table: 'table',
      switch: 'switch',
      slider: 'slider',
      datepicker: 'date-picker',
      nav: 'nav',
      tabs: 'tabs',
      card: 'card',
      divider: 'divider',
      grid: 'grid',
      modal: 'modal',
      drawer: 'drawer',
      chart: 'chart',
      map: 'map',
      richtext: 'rich-text',
    };
    return typeMap[upstreamType] ?? upstreamType;
  }

  private mapToUpstreamType(type: string): string {
    const typeMap: Record<string, string> = {
      rectangle: 'rect',
      text: 'text',
      button: 'button',
      input: 'input',
      image: 'image',
      link: 'link',
      select: 'select',
      radio: 'radio',
      checkbox: 'checkbox',
      table: 'table',
      switch: 'switch',
      slider: 'slider',
      'date-picker': 'datepicker',
      nav: 'nav',
      tabs: 'tabs',
      card: 'card',
      divider: 'divider',
      grid: 'grid',
      modal: 'modal',
      drawer: 'drawer',
      chart: 'chart',
      map: 'map',
      'rich-text': 'richtext',
    };
    return typeMap[type] ?? type;
  }
}
