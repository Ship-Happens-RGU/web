import { useState } from 'react'
import {
  Button,
  Callout,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
  Intent,
  TextArea,
} from '@blueprintjs/core'
import { useCreateScanTree } from '@/composables/ApiWrappers/Scans/useScanTreeMutations'
import type { ScanTree } from '@/types/models'

interface CreateScanTreeDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (tree: ScanTree) => void
}

export default function CreateScanTreeDialog({ isOpen, onClose, onCreated }: CreateScanTreeDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const create = useCreateScanTree()

  const close = () => {
    setName('')
    setDescription('')
    create.reset()
    onClose()
  }

  const submit = () => {
    if (!name.trim()) {
      return
    }

    create.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: (tree) => {
          close()
          onCreated?.(tree)
        },
      },
    )
  }

  return (
    <Dialog isOpen={isOpen} onClose={close} title="New scan tree" icon="folder-new" className={Classes.DARK}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <DialogBody>
          <p className="mb-4 text-body-2 text-white/60">
            A scan tree is a folder that holds every scan of one asset over time. Open it in the viewer to scrub
            through its history.
          </p>

          <FormGroup label="Name" labelFor="scan-tree-name" labelInfo="(required)">
            <InputGroup
              id="scan-tree-name"
              autoFocus
              placeholder="e.g. Platform Alpha – Module 3"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Description" labelFor="scan-tree-description">
            <TextArea
              id="scan-tree-description"
              fill
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormGroup>

          {create.error && <Callout intent={Intent.DANGER}>{create.error.message}</Callout>}
        </DialogBody>

        <DialogFooter
          actions={
            <>
              <Button text="Cancel" onClick={close} />
              <Button
                type="submit"
                intent={Intent.PRIMARY}
                text="Create"
                disabled={!name.trim()}
                loading={create.isPending}
              />
            </>
          }
        />
      </form>
    </Dialog>
  )
}

