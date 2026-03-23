import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

const execAsync = promisify(exec);

export interface UIElementNode {
    id?: string;
    role: string;
    name: string;
    value?: string;
    description?: string;
    bounds: { x: number; y: number; width: number; height: number };
    children: UIElementNode[];
    isClickable: boolean;
}

/**
 * Extracts the OS-level UI accessibility tree into a generic JSON format.
 * This acts as the "Desktop DOM" for the AI to understand non-visual structure.
 */
export class UITreeExtractor {
    
    /**
     * Dumps the current active window's UI tree.
     */
    async getActiveWindowTree(): Promise<UIElementNode | null> {
        const platform = os.platform();
        try {
            switch (platform) {
                case 'darwin':
                    return await this.getMacOSTree();
                case 'linux':
                    return await this.getLinuxTree();
                case 'win32':
                    return await this.getWindowsTree();
                default:
                    throw new Error(`Accessibility tree extraction not supported on ${platform}`);
            }
        } catch (error) {
            console.error('Failed to extract UI tree:', error);
            return null;
        }
    }

    /**
     * macOS implementation using AppleScript (JXA) to query System Events
     */
    private async getMacOSTree(): Promise<UIElementNode | null> {
        // We inject a tiny JXA script to pull the frontmost application's AX elements
        const jxaScript = `
            ObjC.import('CoreGraphics');
            const system = Application('System Events');
            
            const frontApp = system.applicationProcesses.whose({ frontmost: true })[0];
            if (!frontApp) return JSON.stringify(null);
            
            const window = frontApp.windows[0];
            if (!window) return JSON.stringify(null);
            
            function parseElement(uiElem) {
                try {
                    const role = uiElem.role() || "unknown";
                    const name = uiElem.name() || uiElem.title() || "";
                    const value = uiElem.value() ? String(uiElem.value()) : "";
                    const description = uiElem.description() || "";
                    const position = uiElem.position() || [0,0];
                    const size = uiElem.size() || [0,0];
                    
                    let node = {
                        role, name, value, description,
                        bounds: { x: position[0], y: position[1], width: size[0], height: size[1] },
                        children: [],
                        isClickable: ['button', 'checkbox', 'radio button', 'menu item', 'text field'].includes(role)
                    };
                    
                    const uiChildren = uiElem.uiElements();
                    for(let i=0; i<uiChildren.length; i++) {
                        // Limit depth to avoid massive freeze
                        if (name === "" && role === "unknown") continue; 
                        const childParse = parseElement(uiChildren[i]);
                        if (childParse) node.children.push(childParse);
                    }
                    return node;
                } catch(e) {
                    return null;
                }
            }
            
            const root = parseElement(window);
            JSON.stringify(root);
        `;

        try {
            const tmpScript = path.join(os.tmpdir(), 'get_mac_ui.js');
            await fs.writeFile(tmpScript, jxaScript);
            const { stdout } = await execAsync(`osascript -l JavaScript ${tmpScript}`, { maxBuffer: 1024 * 1024 * 10 });
            return JSON.parse(stdout.trim());
        } catch (e) {
            return null;
        }
    }

    /**
     * Linux implementation using \`busctl\` for AT-SPI
     * A more robust Python snippet wrapping pydbus/pyatspi is ideal, but busctl works generically.
     */
    private async getLinuxTree(): Promise<UIElementNode | null> {
        const pyScript = `
import sys, json

def get_tree():
    try:
        import pyatspi
        desktop = pyatspi.Registry.getDesktop(0)
        
        def parse_node(acc):
            try:
                state = acc.getState()
                if not state.contains(pyatspi.STATE_VISIBLE):
                    return None
                    
                bbox = acc.getExtents(pyatspi.COORD_TYPE_SCREEN)
                node = {
                    "role": acc.getRoleName(),
                    "name": acc.name,
                    "description": acc.description,
                    "bounds": {"x": bbox.x, "y": bbox.y, "width": bbox.width, "height": bbox.height},
                    "children": [],
                    "isClickable": state.contains(pyatspi.STATE_FOCUSABLE) or state.contains(pyatspi.STATE_SENSITIVE)
                }
                
                for child in acc:
                    cnode = parse_node(child)
                    if cnode:
                        node["children"].append(cnode)
                return node
            except:
                return None
                
        # Find active window
        for app in desktop:
            try:
                state = app.getState()
                if state.contains(pyatspi.STATE_ACTIVE):
                    for win in app:
                        if win.getState().contains(pyatspi.STATE_ACTIVE):
                            return parse_node(win)
            except:
                pass
    except Exception as e:
        pass
    return None

root = get_tree()
print(json.dumps(root))
`;
        try {
            const tmpScript = path.join(os.tmpdir(), 'get_atspi.py');
            await fs.writeFile(tmpScript, pyScript);
            // Will fail if python3-pyatspi is not installed on linux
            const { stdout } = await execAsync(`python3 ${tmpScript}`);
            return JSON.parse(stdout.trim());
        } catch (e) {
            // Linux fallback: if pyatspi fails, fallback to null
            return null;
        }
    }

    /**
     * Windows implementation using PowerShell UIAutomation
     */
    private async getWindowsTree(): Promise<UIElementNode | null> {
        const psScript = `
            Add-Type -AssemblyName UIAutomationClient
            $root = [System.Windows.Automation.AutomationElement]::RootElement
            $condition = [System.Windows.Automation.Condition]::TrueCondition
            
            # To avoid massive trees, just get the foreground window
            $win32 = Add-Type -MemberDefinition @"
            [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
"@ -Name "Win32" -Namespace "WinAPI" -PassThru
            $hwnd = $win32::GetForegroundWindow()
            
            $activeWindow = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
            
            function Parse-Element($element, $depth) {
                if ($depth -gt 5 -or $null -eq $element) { return $null }
                
                $rect = $element.Current.BoundingRectangle
                $role = $element.Current.ControlType.ProgrammaticName
                $name = $element.Current.Name
                
                $node = @{
                    role = $role
                    name = $name
                    isClickable = $element.Current.IsKeyboardFocusable
                    bounds = @{ x = $rect.X; y = $rect.Y; width = $rect.Width; height = $rect.Height }
                    children = @()
                }
                
                $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
                $child = $walker.GetFirstChild($element)
                
                while ($child -ne $null) {
                    $childNode = Parse-Element $child ($depth + 1)
                    if ($null -ne $childNode) { $node.children += $childNode }
                    $child = $walker.GetNextSibling($child)
                }
                return $node
            }
            
            $tree = Parse-Element $activeWindow 0
            $tree | ConvertTo-Json -Depth 10
        `;
        
        try {
            const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, { maxBuffer: 1024 * 1024 * 10 });
            return JSON.parse(stdout.trim());
        } catch (e) {
            return null;
        }
    }
}
