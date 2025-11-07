import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "multiselect" | "file";
  label: string;
  required: boolean;
  options?: string[];
}

export default function FormBuilder() {
  const [fields, setFields] = useState<FormField[]>([]);
  const [templateName, setTemplateName] = useState("");

  const addField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: `New ${type} field`,
      required: false,
      options: type === "select" || type === "multiselect" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
    console.log("Field added:", newField);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    console.log("Field removed:", id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  return (
    <div className="grid grid-cols-12 gap-6" data-testid="builder-form">
      <div className="col-span-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Field Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => addField("text")} data-testid="button-add-text">
              <Plus className="h-4 w-4 mr-2" />
              Text Input
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => addField("textarea")} data-testid="button-add-textarea">
              <Plus className="h-4 w-4 mr-2" />
              Text Area
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => addField("select")} data-testid="button-add-select">
              <Plus className="h-4 w-4 mr-2" />
              Dropdown
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => addField("multiselect")} data-testid="button-add-multiselect">
              <Plus className="h-4 w-4 mr-2" />
              Multi-Select
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => addField("file")} data-testid="button-add-file">
              <Plus className="h-4 w-4 mr-2" />
              File Upload
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-8">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Refund Process Gap"
                  data-testid="input-template-name"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                Add fields from the palette to build your form
              </div>
            ) : (
              fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-move" />
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{field.type}</Badge>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            className="flex-1"
                            data-testid={`input-field-label-${index}`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(field.id, { required: e.target.checked })}
                              className="rounded"
                              data-testid={`checkbox-field-required-${index}`}
                            />
                            Required
                          </label>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(field.id)}
                        data-testid={`button-remove-field-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
            {fields.length > 0 && (
              <Button className="w-full" data-testid="button-save-template">
                Save Template
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
