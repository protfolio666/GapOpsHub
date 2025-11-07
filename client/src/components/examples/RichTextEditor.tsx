import RichTextEditor from "../RichTextEditor";
import { useState } from "react";

export default function RichTextEditorExample() {
  const [content, setContent] = useState("");

  return (
    <div className="p-4 max-w-2xl">
      <RichTextEditor
        content={content}
        onChange={(html) => {
          setContent(html);
          console.log("Content changed:", html);
        }}
        placeholder="Describe the process gap..."
      />
    </div>
  );
}
